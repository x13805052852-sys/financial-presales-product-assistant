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
  );

  assert.equal(result.status, "answered");
  assert.equal(result.requestId, "request-1");
  assert.ok(result.knowledgeIds.some((id) => ["CP-M003", "CP-M013"].includes(id)));
  assert.ok(result.sources.length > 0);
  assert.equal(result.experimental, true);
  assert.equal(logger.events[0]?.status, "answered");
  assert.equal(logger.events[0]?.questionPreview.includes("API_KEY"), false);
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
