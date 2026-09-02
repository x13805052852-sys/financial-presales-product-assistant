import assert from "node:assert/strict";
import test from "node:test";

import { resolveContext } from "./context-resolver.js";
import type { ContextSnapshot } from "./types.js";

const key = "a".repeat(64);
const now = 10 * 60 * 1_000;

function previous(overrides: Partial<ContextSnapshot> = {}): ContextSnapshot {
  return {
    sessionKeyHash: key,
    messageId: "previous-message",
    question: "客户需要数据治理并要求实时流动达到毫秒级，应该怎么搭配？",
    resolvedQuestion: "客户需要数据治理并要求实时流动达到毫秒级，应该怎么搭配？",
    intent: "solution_recommendation",
    products: ["Slipstream", "ArgoDB AP", "TDS-SUITE-D"],
    capabilities: ["流式ETL", "实时分析", "数据治理"],
    recommendations: ["Slipstream + ArgoDB AP + TDS-SUITE-D"],
    knowledgeIds: ["CP-M001"],
    answerSummary: "毫秒级实时治理",
    status: "answered",
    createdAt: now - 60_000,
    ...overrides,
  };
}

function decide(question: string, overrides: Record<string, unknown> = {}) {
  return resolveContext({
    question,
    currentSessionKeyHash: key,
    previous: previous(),
    now,
    ...overrides,
  });
}

test("inherits an elliptical continuation at the threshold", () => {
  const decision = decide("所以正常能到多少？");

  assert.equal(decision.followUp, true);
  assert.ok(decision.score >= 4);
  assert.ok(decision.matchedRules.includes("continuation_cue"));
  assert.ok(decision.matchedRules.includes("omitted_subject"));
});

test("inherits a natural scenario follow-up", () => {
  const decision = decide("那银行能用吗？");

  assert.equal(decision.followUp, true);
  assert.ok(decision.score >= 4);
});

test("inherits a retry after a retryable error", () => {
  const decision = decide("再试一下", {
    previous: previous({ status: "retryable_error" }),
  });

  assert.equal(decision.followUp, true);
  assert.ok(decision.matchedRules.includes("retry_request"));
});

test("uses a matching quote as a strong follow-up signal", () => {
  const decision = decide("实际能到多少？", {
    quoteText: "毫秒级实时治理",
  });

  assert.equal(decision.followUp, true);
  assert.ok(decision.matchedRules.includes("matching_quote"));
});

test("does not treat an unrelated quote as matching context", () => {
  const decision = decide("Astro目前更新了哪些功能？", {
    quoteText: "这是另一个不相关机器人的回答",
  });

  assert.equal(decision.followUp, false);
  assert.ok(!decision.matchedRules.includes("matching_quote"));
});

test("starts a new question for a complete different product topic", () => {
  const decision = decide("Astro目前更新了哪些主要功能？");

  assert.equal(decision.followUp, false);
  assert.ok(decision.matchedRules.includes("different_product"));
});

test("keeps a complete independent question new even with the same product", () => {
  const decision = decide("ArgoDB支持哪些备份恢复方式？");

  assert.equal(decision.followUp, false);
  assert.ok(decision.score < 4);
});

test("refuses context with no previous turn, an expired turn or another identity", () => {
  assert.equal(
    resolveContext({ question: "所以呢？", currentSessionKeyHash: key, now }).reason,
    "no_previous_turn",
  );

  assert.equal(
    decide("所以呢？", { previous: previous({ createdAt: now - 30 * 60 * 1_000 }) }).reason,
    "expired",
  );

  assert.equal(
    decide("所以呢？", { currentSessionKeyHash: "b".repeat(64) }).reason,
    "identity_mismatch",
  );
});

test("defaults unsafe and ambiguous input to a new question", () => {
  assert.equal(decide("所以合同价格是多少？", { unsafe: true }).reason, "unsafe");
  assert.equal(decide("还有哪些选择？").followUp, false);
});
