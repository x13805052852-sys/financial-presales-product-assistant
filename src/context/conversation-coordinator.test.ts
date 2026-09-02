import assert from "node:assert/strict";
import test from "node:test";

import type { ContextAuditMetadata } from "../app/audit-logger.js";
import type { AnswerResult } from "../app/presales-assistant.js";
import { ConversationCoordinator } from "./conversation-coordinator.js";
import { OneTurnContextStore } from "./one-turn-context-store.js";
import type { ConversationIdentity, GroundingSummary } from "./types.js";

const groupUserOne: ConversationIdentity = {
  chatType: "group",
  chatId: "group-1",
  userId: "user-1",
};
const groupUserTwo: ConversationIdentity = {
  chatType: "group",
  chatId: "group-1",
  userId: "user-2",
};

function grounding(question: string): GroundingSummary {
  if (question.includes("Astro")) {
    return {
      normalizedQuestion: "astro功能",
      topicLabel: "Astro主要功能",
      products: ["Astro"],
      capabilities: ["自然语言交互", "任务编排"],
      recommendations: ["Astro"],
      knowledgeIds: ["CP-M021"],
    };
  }
  return {
    normalizedQuestion: "实时数据治理",
    topicLabel: "毫秒级实时治理",
    products: ["Slipstream", "ArgoDB AP", "TDS-SUITE-D"],
    capabilities: ["流式ETL", "实时分析", "数据治理"],
    recommendations: ["Slipstream + ArgoDB AP + TDS-SUITE-D"],
    knowledgeIds: ["CP-M001"],
  };
}

class FakeAssistant {
  readonly questions: string[] = [];
  readonly audits: Array<ContextAuditMetadata | undefined> = [];
  nextStatus: AnswerResult["status"] | undefined;

  async answerQuestion(
    question: string,
    requestId: string,
    contextAudit?: ContextAuditMetadata,
  ): Promise<AnswerResult> {
    this.questions.push(question);
    this.audits.push(contextAudit);
    const status = this.nextStatus ?? (question.includes("价格") ? "refused" : "answered");
    this.nextStatus = undefined;
    return {
      requestId,
      status,
      message:
        status === "answered"
          ? "结论：测试回答。\n推荐组合：ArgoDB AP\n产品分工：ArgoDB AP 负责分析。"
          : status === "model_error"
            ? "服务暂时不可用，请稍后重试。"
            : "该问题不能直接回答。",
      knowledgeIds: grounding(question).knowledgeIds,
      sources: ["source#1"],
      elapsedMs: 10,
      experimental: true,
      answerFramework: "solution_recommendation",
      groundingSummary: grounding(question),
    };
  }
}

function createCoordinator(assistant: FakeAssistant, now: () => number = () => 1_000) {
  return new ConversationCoordinator(
    assistant,
    new OneTurnContextStore({ now }),
    { now },
  );
}

test("inherits only the immediately previous turn for the same user", async () => {
  const assistant = new FakeAssistant();
  const coordinator = createCoordinator(assistant);

  await coordinator.answerQuestion(
    "客户需要实时数据治理并要求毫秒级，应该怎么搭配？",
    "message-1",
    { identity: groupUserOne },
  );
  const result = await coordinator.answerQuestion("所以正常能到多少？", "message-2", {
    identity: groupUserOne,
  });

  assert.match(assistant.questions[1] ?? "", /上一轮客户需求/u);
  assert.match(assistant.questions[1] ?? "", /Slipstream \+ ArgoDB AP \+ TDS-SUITE-D/u);
  assert.match(result.message, /^承接上一问：毫秒级实时治理/u);
  assert.equal(result.contextDecision?.followUp, true);
});

test("isolates another salesperson in the same group", async () => {
  const assistant = new FakeAssistant();
  const coordinator = createCoordinator(assistant);

  await coordinator.answerQuestion("客户需要实时数据治理，怎么搭配？", "message-1", {
    identity: groupUserOne,
  });
  const result = await coordinator.answerQuestion("那银行能用吗？", "message-2", {
    identity: groupUserTwo,
  });

  assert.equal(assistant.questions[1], "那银行能用吗？");
  assert.equal(result.contextDecision?.reason, "no_previous_turn");
  assert.doesNotMatch(result.message, /^承接上一问/u);
});

test("a complete new topic replaces the old turn", async () => {
  const assistant = new FakeAssistant();
  const coordinator = createCoordinator(assistant);

  await coordinator.answerQuestion("客户需要实时数据治理，怎么搭配？", "message-1", {
    identity: groupUserOne,
  });
  await coordinator.answerQuestion("Astro目前更新了哪些主要功能？", "message-2", {
    identity: groupUserOne,
  });
  await coordinator.answerQuestion("那主要有哪些？", "message-3", {
    identity: groupUserOne,
  });

  assert.match(assistant.questions[2] ?? "", /Astro目前更新/u);
  assert.doesNotMatch(assistant.questions[2] ?? "", /实时数据治理/u);
});

test("a sensitive refusal does not overwrite the valid previous turn", async () => {
  const assistant = new FakeAssistant();
  const coordinator = createCoordinator(assistant);

  await coordinator.answerQuestion("客户需要实时数据治理，怎么搭配？", "message-1", {
    identity: groupUserOne,
  });
  await coordinator.answerQuestion("所以合同价格是多少？", "message-2", {
    identity: groupUserOne,
  });
  await coordinator.answerQuestion("所以正常能到多少？", "message-3", {
    identity: groupUserOne,
  });

  assert.match(assistant.questions[2] ?? "", /客户需要实时数据治理/u);
});

test("stores a retryable error and retries the failed question", async () => {
  const assistant = new FakeAssistant();
  const coordinator = createCoordinator(assistant);
  assistant.nextStatus = "model_error";

  await coordinator.answerQuestion("实时数据治理应该怎么搭配？", "message-1", {
    identity: groupUserOne,
  });
  await coordinator.answerQuestion("再试一下", "message-2", { identity: groupUserOne });

  assert.equal(assistant.questions[1], "实时数据治理应该怎么搭配？");
  assert.ok(assistant.audits[1]?.contextRules.includes("retry_request"));
});

test("falls back to a standalone answer when identity data is invalid", async () => {
  const assistant = new FakeAssistant();
  const coordinator = createCoordinator(assistant);

  const result = await coordinator.answerQuestion("Astro有哪些功能？", "message-1", {
    identity: { chatType: "group", userId: "user-1" },
  });

  assert.equal(result.status, "answered");
  assert.equal(assistant.questions[0], "Astro有哪些功能？");
  assert.equal(result.contextDecision?.reason, "resolver_error");
});
