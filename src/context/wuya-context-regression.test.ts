import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parse } from "csv-parse/sync";

import { loadKnowledgeBase } from "../knowledge/loader.js";
import { normalizeText } from "../knowledge/normalize.js";
import { retrieveKnowledge } from "../knowledge/retriever.js";
import { resolveContext } from "./context-resolver.js";
import { resolveQuestion } from "./question-resolver.js";
import { createSessionKey } from "./session-key.js";
import type { ContextSnapshot, ConversationIdentity } from "./types.js";

type CsvRow = Record<string, string>;

const now = 20 * 60 * 1_000;
const knowledgeBase = loadKnowledgeBase();

function identity(groupId: string, userId: string): ConversationIdentity {
  return { chatType: "group", chatId: groupId, userId };
}

function products(value: string): string[] {
  return value.split(/\s*\+\s*|[;；/]/u).map((item) => item.trim()).filter(Boolean);
}

function previousSnapshot(row: CsvRow): ContextSnapshot {
  const previousIdentity = identity(row["群聊ID"] ?? "", row["上一轮用户ID"] ?? "");
  const previousProducts = products(row["上一轮产品"] ?? "");
  const topic = row["上一轮主题"] ?? "";
  return {
    sessionKeyHash: createSessionKey(previousIdentity),
    messageId: `${row["编号"]}-previous`,
    question: row["上一问"] ?? "",
    resolvedQuestion: row["上一问"] ?? "",
    intent: "solution_recommendation",
    products: previousProducts,
    capabilities: [topic],
    recommendations: [previousProducts.join(" + ")],
    knowledgeIds: ["synthetic-wuya-context"],
    answerSummary: topic,
    status: "answered",
    createdAt: now - 60_000,
  };
}

test("meets the WUYA one-turn context and product retrieval gates", () => {
  const rows = parse(
    readFileSync(
      join(process.cwd(), "docs/knowledge/WUYA_CONTEXT_TWO_TURN_TEST_QUESTIONS_100.csv"),
      "utf8",
    ),
    { bom: true, columns: true, skip_empty_lines: true, trim: true },
  ) as CsvRow[];
  let correct = 0;
  let expectedNewQuestions = 0;
  let falseInheritances = 0;
  let productChecks = 0;
  let productMatches = 0;
  const failures: string[] = [];
  const productFailures: string[] = [];

  for (const row of rows) {
    const previous = previousSnapshot(row);
    const currentIdentity = identity(row["群聊ID"] ?? "", row["当前用户ID"] ?? "");
    const decision = resolveContext({
      question: row["当前问"] ?? "",
      currentSessionKeyHash: createSessionKey(currentIdentity),
      previous,
      ...(row["是否引用"] === "是" ? { quoteText: row["上一问"] } : {}),
      now,
    });
    const expectedFollowUp = row["期望是否继承"] === "是";
    if (decision.followUp === expectedFollowUp) {
      correct += 1;
    } else {
      failures.push(
        `${row["编号"]}: expected=${expectedFollowUp} actual=${decision.followUp} score=${decision.score}`,
      );
    }
    if (!expectedFollowUp) {
      expectedNewQuestions += 1;
      if (decision.followUp) falseInheritances += 1;
    }

    const resolution = resolveQuestion(row["当前问"] ?? "", previous, decision);
    const expectedKeyword = row["期望补全关键词"] ?? "";
    if (expectedKeyword && expectedKeyword !== "无") {
      assert.ok(
        normalizeText(resolution.resolvedQuestion).includes(normalizeText(expectedKeyword)),
        `${row["编号"]} missing resolved keyword ${expectedKeyword}`,
      );
    }

    const expectedProduct = row["期望核心产品"] ?? "";
    if (expectedProduct && expectedProduct !== "无") {
      productChecks += 1;
      const evidence = retrieveKnowledge(resolution.resolvedQuestion, knowledgeBase).hits
        .flatMap((hit) => [
          hit.entry.title,
          hit.entry.primaryRecommendation,
          hit.entry.optionalRecommendation,
          hit.entry.responsibilities,
        ])
        .join("；");
      const expectedParts = products(expectedProduct);
      if (expectedParts.every((part) => normalizeText(evidence).includes(normalizeText(part)))) {
        productMatches += 1;
      } else {
        productFailures.push(`${row["编号"]}: ${expectedProduct}`);
      }
    }
  }

  assert.equal(rows.length, 100);
  assert.ok(correct / rows.length >= 0.95, failures.join("\n"));
  assert.ok(
    falseInheritances / expectedNewQuestions <= 0.02,
    `false inheritances ${falseInheritances}/${expectedNewQuestions}\n${failures.join("\n")}`,
  );
  assert.ok(
    productMatches / productChecks >= 0.9,
    `product retrieval matches ${productMatches}/${productChecks}\n${productFailures.join("\n")}`,
  );
});
