import assert from "node:assert/strict";
import test from "node:test";

import type { LlmConfig } from "../config.js";
import { loadKnowledgeBase } from "../knowledge/loader.js";
import { retrieveKnowledge } from "../knowledge/retriever.js";
import { validateAnswer } from "./answer-validator.js";
import { ModelRequestError, OpenAiCompatibleClient } from "./openai-compatible-client.js";
import { buildGroundedRequest } from "./prompt.js";

const config: LlmConfig = {
  baseUrl: "https://example.invalid/v1/",
  apiKey: "secret-value-must-not-appear",
  model: "test-model",
  timeoutMs: 2_000,
  maxRetries: 2,
};

const knowledgeBase = loadKnowledgeBase();
const hits = retrieveKnowledge(
  "实时数据进入分析数据库并同时做治理",
  knowledgeBase,
).hits;

test("builds a grounded request with the fixed three-part format", () => {
  const request = buildGroundedRequest("客户需要实时数据库和治理", hits);
  const content = request.messages.map((message) => message.content).join("\n");

  assert.match(content, /只能依据提供的知识证据回答/);
  assert.match(content, /结论：/);
  assert.match(content, /推荐组合：/);
  assert.match(content, /产品分工：/);
  assert.match(content, /CP-M003|CP-M013/);
});

test("builds a product overview request without forcing a product combination", () => {
  const request = buildGroundedRequest(
    "告诉我 Astro 目前的更新主要功能有哪些",
    hits,
    "product_overview",
  );
  const content = request.messages.map((message) => message.content).join("\n");

  assert.match(content, /产品功能介绍/);
  assert.match(content, /结论、主要功能/);
  assert.match(content, /禁止标题：推荐组合、产品分工/);
  assert.match(content, /不得把当前功能称为新增功能/);
});

test("builds a risk explanation request with conflict-specific headings", () => {
  const request = buildGroundedRequest(
    "Astro 两份资料为什么不一致？",
    hits,
    "risk_explanation",
  );
  const content = request.messages.map((message) => message.content).join("\n");

  assert.match(content, /冲突点、实际影响、销售口径/);
  assert.match(content, /不要因为清单冲突直接否定/);
});

test("accepts a grounded three-part answer", () => {
  const answer = [
    "结论：该场景可以通过实时分析数据库配合专业治理工具实现。",
    "推荐组合：ArgoDB AP + TDS-SUITE-R + TDS-SUITE-D",
    "产品分工：ArgoDB AP 负责实时分析，TDS 负责同步与治理。",
  ].join("\n");

  const result = validateAnswer(answer, hits, {
    knownProductNames: ["ArgoDB AP", "ArgoDB HTAP", "TDS-SUITE-D"],
  });
  assert.equal(result.valid, true);
});

test("rejects missing sections and products absent from evidence", () => {
  const result = validateAnswer(
    "结论：可以。\n推荐组合：Scope",
    hits,
    { knownProductNames: ["Scope"] },
  );

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("产品分工")));
  assert.deepEqual(result.unsupportedProducts, ["Scope"]);
});

test("accepts product overview and risk explanation formats", () => {
  const overview = validateAnswer(
    "结论：当前资料描述了 Astro 的主要能力。\n主要功能：自然语言入口与智能任务编排。\n口径说明：功能清单以目标版本为准。",
    hits,
    { frameworkId: "product_overview" },
  );
  const risk = validateAnswer(
    "冲突点：两份资料的智能体数量和名称不同。\n实际影响：影响销售和交付口径。\n销售口径：按具体能力描述并确认目标版本。",
    hits,
    { frameworkId: "risk_explanation" },
  );

  assert.equal(overview.valid, true);
  assert.equal(risk.valid, true);
});

test("rejects forbidden and duplicate headings for the selected framework", () => {
  const wrongOverview = validateAnswer(
    "结论：当前资料描述了主要能力。\n主要功能：智能编排。\n推荐组合：Astro。",
    hits,
    { frameworkId: "product_overview" },
  );
  const duplicateRisk = validateAnswer(
    "结论：可以实现。\n推荐组合：ArgoDB AP。\n产品分工：ArgoDB AP 负责分析。\n风险说明：待确认。\n风险说明：仍待确认。",
    hits,
    { frameworkId: "solution_recommendation" },
  );

  assert.ok(wrongOverview.errors.some((error) => error.includes("forbidden section")));
  assert.ok(duplicateRisk.errors.some((error) => error.includes("duplicate section")));
});

test("returns a valid completion through the OpenAI-compatible endpoint", async () => {
  let requestedUrl = "";
  const client = new OpenAiCompatibleClient(config, {
    fetchImplementation: async (input) => {
      requestedUrl = String(input);
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "模型连接成功" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const content = await client.complete({ messages: [{ role: "user", content: "测试" }] });
  assert.equal(content, "模型连接成功");
  assert.equal(requestedUrl, "https://example.invalid/v1/chat/completions");
});

test("retries a temporary 503 and then succeeds", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const client = new OpenAiCompatibleClient(config, {
    fetchImplementation: async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify([{ error: { message: "high demand" } }]), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "成功" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
    sleep: async (milliseconds) => {
      delays.push(milliseconds);
    },
  });

  assert.equal(await client.complete({ messages: [{ role: "user", content: "测试" }] }), "成功");
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [250]);
});

test("does not include the API key when a request fails permanently", async () => {
  const client = new OpenAiCompatibleClient(
    { ...config, maxRetries: 0 },
    {
      fetchImplementation: async () =>
        new Response(JSON.stringify({ error: { message: "unauthorized" } }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    },
  );

  await assert.rejects(
    () => client.complete({ messages: [{ role: "user", content: "测试" }] }),
    (error: unknown) => {
      assert.ok(error instanceof ModelRequestError);
      assert.equal(error.status, 401);
      assert.doesNotMatch(error.message, /secret-value-must-not-appear/);
      return true;
    },
  );
});
