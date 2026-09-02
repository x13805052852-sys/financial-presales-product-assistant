import assert from "node:assert/strict";
import test from "node:test";

import { buildContextBanner, resolveQuestion } from "./question-resolver.js";
import type { ContextDecision, ContextSnapshot } from "./types.js";

const previous: ContextSnapshot = {
  sessionKeyHash: "a".repeat(64),
  messageId: "previous-message",
  question: "客户需要实时数据治理并询问毫秒级能力",
  resolvedQuestion: "客户需要实时数据治理并询问毫秒级能力",
  intent: "solution_recommendation",
  products: ["Slipstream", "ArgoDB AP", "TDS-SUITE-D"],
  capabilities: ["流式ETL", "实时分析", "数据治理"],
  recommendations: ["Slipstream + ArgoDB AP + TDS-SUITE-D"],
  knowledgeIds: ["CP-M001"],
  answerSummary: "毫秒级实时治理",
  status: "answered",
  createdAt: 1_000,
};

const followUp: ContextDecision = {
  followUp: true,
  score: 5,
  matchedRules: ["continuation_cue", "omitted_subject"],
  reason: "follow_up",
};

test("completes a follow-up with structured previous context", () => {
  const result = resolveQuestion("所以正常能到多少？", previous, followUp);

  assert.match(result.resolvedQuestion, /实时数据治理/u);
  assert.match(result.resolvedQuestion, /Slipstream \+ ArgoDB AP \+ TDS-SUITE-D/u);
  assert.match(result.resolvedQuestion, /所以正常能到多少/u);
  assert.doesNotMatch(result.resolvedQuestion, /资料来源/u);
  assert.equal(result.contextBanner, "承接上一问：毫秒级实时治理");
});

test("keeps a new question unchanged", () => {
  const decision: ContextDecision = {
    followUp: false,
    score: -4,
    matchedRules: ["different_product"],
    reason: "new_question",
  };

  assert.deepEqual(resolveQuestion("Astro有哪些功能？", previous, decision), {
    resolvedQuestion: "Astro有哪些功能？",
  });
});

test("retries the previously resolved question without adding retry words", () => {
  const retrySnapshot = { ...previous, status: "retryable_error" as const };
  const decision = { ...followUp, matchedRules: ["retry_request"] };

  const result = resolveQuestion("再试一下", retrySnapshot, decision);

  assert.equal(result.resolvedQuestion, previous.resolvedQuestion);
});

test("limits and redacts the visible context banner", () => {
  const banner = buildContextBanner({
    ...previous,
    answerSummary: "客户13800138000要求报价100万元并联系sales@example.com讨论实时数据治理方案",
  });

  assert.ok(banner);
  assert.match(banner ?? "", /^承接上一问：/u);
  assert.doesNotMatch(banner ?? "", /13800138000|100万元|sales@example\.com/u);
  assert.ok(Array.from((banner ?? "").replace(/^承接上一问：/u, "")).length <= 20);
});

test("omits a banner when no safe summary exists", () => {
  assert.equal(buildContextBanner({ ...previous, answerSummary: "" }), undefined);
});
