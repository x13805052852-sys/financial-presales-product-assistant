import assert from "node:assert/strict";
import test from "node:test";

import { OneTurnContextStore } from "./one-turn-context-store.js";
import type { ContextSnapshot } from "./types.js";

function snapshot(sessionKeyHash: string, messageId: string, createdAt: number): ContextSnapshot {
  return {
    sessionKeyHash,
    messageId,
    question: `question-${messageId}`,
    resolvedQuestion: `resolved-${messageId}`,
    intent: "solution_recommendation",
    products: ["ArgoDB AP"],
    capabilities: ["实时分析"],
    recommendations: ["ArgoDB AP + TDS-SUITE-D"],
    knowledgeIds: ["CP-M001"],
    answerSummary: "实时治理",
    status: "answered",
    createdAt,
  };
}

test("keeps only the latest turn for a session", () => {
  let now = 1_000;
  const store = new OneTurnContextStore({ now: () => now });
  const key = "a".repeat(64);

  store.set(snapshot(key, "first", now));
  now += 10;
  store.set(snapshot(key, "second", now));

  assert.equal(store.get(key)?.messageId, "second");
  assert.equal(store.size, 1);
});

test("expires a snapshot after thirty minutes", () => {
  let now = 0;
  const store = new OneTurnContextStore({ now: () => now });
  const key = "b".repeat(64);
  store.set(snapshot(key, "message", now));

  now = 30 * 60 * 1_000 - 1;
  assert.equal(store.get(key)?.messageId, "message");

  now += 1;
  assert.equal(store.get(key), undefined);
  assert.equal(store.size, 0);
});

test("evicts the oldest session at the capacity limit", () => {
  let now = 0;
  const store = new OneTurnContextStore({ maximumEntries: 2, now: () => now });
  const firstKey = "1".repeat(64);
  const secondKey = "2".repeat(64);
  const thirdKey = "3".repeat(64);

  store.set(snapshot(firstKey, "first", now));
  now += 1;
  store.set(snapshot(secondKey, "second", now));
  now += 1;
  store.set(snapshot(thirdKey, "third", now));

  assert.equal(store.get(firstKey), undefined);
  assert.equal(store.get(secondKey)?.messageId, "second");
  assert.equal(store.get(thirdKey)?.messageId, "third");
  assert.equal(store.size, 2);
});
