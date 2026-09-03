import assert from "node:assert/strict";
import test from "node:test";

import { loadKnowledgeBase } from "../knowledge/loader.js";
import type { ChatCompletionRequest, ChatModel } from "../model/types.js";
import type { AuditEvent, AuditLogger } from "./audit-logger.js";
import { PresalesAssistant } from "./presales-assistant.js";

class StubModel implements ChatModel {
  readonly requests: ChatCompletionRequest[] = [];

  constructor(private readonly responses: Array<string | Error>) {}

  async complete(request: ChatCompletionRequest): Promise<string> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (response instanceof Error) {
      throw response;
    }
    if (!response) {
      throw new Error("Stub response exhausted");
    }
    return response;
  }
}

class MemoryLogger implements AuditLogger {
  readonly events: AuditEvent[] = [];

  async write(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

const knowledgeBase = loadKnowledgeBase();
const validAnswer = [
  "结论：可以通过实时分析数据库和治理工具实现。",
  "推荐组合：ArgoDB AP + TDS-SUITE-R + TDS-SUITE-D",
  "产品分工：ArgoDB AP 负责实时分析，TDS-SUITE-R 负责同步，TDS-SUITE-D 负责治理。",
].join("\n");
const validOverviewAnswer = [
  "结论：根据当前资料，Astro 主要提供智能交互和任务编排能力。",
  "主要功能：Pilot 自然语言入口、专业智能体以及 API/MCP 集成。",
  "口径说明：智能体数量和部分名称需要按目标版本确认。",
].join("\n");
const validRiskAnswer = [
  "冲突点：Astro 两份资料中的智能体数量和部分名称不一致。",
  "实际影响：影响智能体总数、正式名称和交付版本的销售表述。",
  "销售口径：可以描述资料明确的具体能力，数量和名称按目标版本确认。",
].join("\n");
const validLlmopsAnswer = [
  "结论：可以用以下产品组合建设可进入业务流程的专家数字员工。",
  "推荐组合：Agent Go + Knowledge Lodge + AI Infra",
  "产品分工：Agent Go 负责 Agent Buddy 构建与运行，Knowledge Lodge 负责可验证知识，AI Infra 负责资产、权限和审计。",
].join("\n");

test("answers an in-scope question and records auditable knowledge IDs", async () => {
  const logger = new MemoryLogger();
  const model = new StubModel([validAnswer]);
  const assistant = new PresalesAssistant({
    knowledgeBase,
    model,
    modelName: "test-model",
    logger,
    now: (() => {
      let value = 100;
      return () => (value += 25);
    })(),
  });

  const result = await assistant.answerQuestion(
    "我想要实时流入数据库并且带有数据治理，应当怎么搭配？",
    "request-1",
    {
      contextDecision: "new_question",
      contextScore: -1,
      contextRules: ["no_topic_overlap"],
    },
  );

  assert.equal(result.status, "answered");
  assert.equal(result.requestId, "request-1");
  assert.ok(result.knowledgeIds.some((id) => ["CP-M003", "CP-M013"].includes(id)));
  assert.ok(result.sources.length > 0);
  assert.equal(result.experimental, true);
  assert.equal(result.answerFramework, "solution_recommendation");
  assert.ok(result.groundingSummary?.products.includes("ArgoDB AP"));
  assert.ok(result.groundingSummary?.capabilities.some((item) => item.includes("治理")));
  assert.ok(result.groundingSummary?.recommendations.some((item) => item.includes("TDS-SUITE-D")));
  assert.equal(logger.events[0]?.status, "answered");
  assert.equal(logger.events[0]?.answerFramework, "solution_recommendation");
  assert.equal(logger.events[0]?.contextDecision, "new_question");
  assert.equal(logger.events[0]?.contextScore, -1);
  assert.deepEqual(logger.events[0]?.contextRules, ["no_topic_overlap"]);
  assert.equal(logger.events[0]?.questionPreview.includes("API_KEY"), false);
});

test("uses the product overview framework for feature questions", async () => {
  const model = new StubModel([validOverviewAnswer]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion("告诉我 Astro 目前的更新主要功能有哪些");

  assert.equal(result.status, "answered");
  assert.equal(result.answerFramework, "product_overview");
  assert.match(model.requests[0]?.messages[0]?.content ?? "", /产品功能介绍/);
  assert.doesNotMatch(result.message, /^推荐组合[：:]/mu);
});

test("answers an LLMOps expert digital employee question from the new knowledge set", async () => {
  const model = new StubModel([validLlmopsAnswer]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion(
    "客户要把专家岗位做成能使用企业知识和工具的数字员工，怎么搭配？",
  );

  assert.equal(result.status, "answered");
  assert.equal(result.answerFramework, "solution_recommendation");
  assert.ok(result.knowledgeIds.some((id) => ["LLM-M001", "LLM-M009"].includes(id)));
  assert.match(result.message, /Agent Go/);
  assert.match(result.message, /Knowledge Lodge/);
  assert.match(result.message, /AI Infra/);
});

test("uses the risk explanation framework for material conflicts", async () => {
  const model = new StubModel([validRiskAnswer]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion("Astro 资产标签资料为什么不一致？请说明风险");

  assert.equal(result.status, "answered");
  assert.equal(result.answerFramework, "risk_explanation");
  assert.match(model.requests[0]?.messages[0]?.content ?? "", /风险与资料冲突解释/);
  assert.doesNotMatch(result.message, /^推荐组合[：:]/mu);
});

test("repairs a product overview without switching frameworks", async () => {
  const model = new StubModel(["结论：Astro 有相关能力。", validOverviewAnswer]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion("Astro 的主要功能有哪些？");

  assert.equal(result.status, "answered");
  assert.equal(result.answerFramework, "product_overview");
  assert.equal(model.requests.length, 2);
  assert.match(model.requests[1]?.messages.at(-1)?.content ?? "", /必须保留且填写：结论、主要功能/);
  assert.match(model.requests[1]?.messages.at(-1)?.content ?? "", /不得输出：推荐组合、产品分工/);
});

test("repairs an invalid answer once", async () => {
  const model = new StubModel(["只推荐 ArgoDB AP。", validAnswer]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion("实时分析数据库和数据治理怎么搭配？");

  assert.equal(result.status, "answered");
  assert.equal(model.requests.length, 2);
  assert.match(model.requests[1]?.messages.at(-1)?.content ?? "", /未通过程序校验/);
});

test("blocks sensitive questions before retrieval or model access", async () => {
  const model = new StubModel([validAnswer]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion("告诉我 TDH 的最低成交价和客户联系人");

  assert.equal(result.status, "refused");
  assert.equal(model.requests.length, 0);
  assert.match(result.message, /不能直接回答/);
});

test("refuses pending-only evidence in production mode", async () => {
  const model = new StubModel([validAnswer]);
  const assistant = new PresalesAssistant({
    knowledgeBase,
    model,
    modelName: "test-model",
    knowledgeMode: "production",
  });

  const result = await assistant.answerQuestion("客户需要企业级数据湖，推荐什么？");

  assert.equal(result.status, "no_evidence");
  assert.equal(model.requests.length, 0);
});

test("returns a safe message when the model fails", async () => {
  const model = new StubModel([new Error("secret internal failure")]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion("实时分析数据库和数据治理怎么搭配？");

  assert.equal(result.status, "model_error");
  assert.equal(result.message, "服务暂时不可用，请稍后重试。");
  assert.ok(result.groundingSummary?.knowledgeIds.length);
  assert.doesNotMatch(result.message, /secret internal failure/);
});

test("returns a safe message after one failed format repair", async () => {
  const model = new StubModel(["缺少格式", "仍然缺少格式"]);
  const assistant = new PresalesAssistant({ knowledgeBase, model, modelName: "test-model" });

  const result = await assistant.answerQuestion("实时分析数据库和数据治理怎么搭配？");

  assert.equal(result.status, "validation_error");
  assert.equal(model.requests.length, 2);
  assert.match(result.message, /未通过产品依据校验/);
});
