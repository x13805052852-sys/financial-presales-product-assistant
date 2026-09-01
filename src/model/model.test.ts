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
