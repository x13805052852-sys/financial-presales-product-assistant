import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { parse } from "csv-parse/sync";

import { loadKnowledgeBase } from "./loader.js";
import { normalizeText, recognizeProducts } from "./normalize.js";
import { retrieveKnowledge } from "./retriever.js";

type CsvRow = Record<string, string>;

function readCsv(relativePath: string): CsvRow[] {
  return parse(readFileSync(join(process.cwd(), relativePath), "utf8"), {
    bom: true,
    columns: (headers: string[]) => headers.map((header) => header.trim()),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as CsvRow[];
}

const knowledgeBase = loadKnowledgeBase();

test("loads aliases and both kinds of auditable knowledge", () => {
  assert.ok(knowledgeBase.aliases.length >= 10);
  assert.ok(knowledgeBase.entries.some((entry) => entry.kind === "capability"));
  assert.equal(
    knowledgeBase.entries.filter((entry) => entry.kind === "combination").length,
    40,
  );
  assert.ok(knowledgeBase.entries.every((entry) => entry.id && entry.sources.length > 0));
});

test("normalizes product aliases without losing the canonical product", () => {
  assert.equal(normalizeText(" TDH 湖仓集一体版 "), "tdh湖仓集一体版");
  assert.ok(
    recognizeProducts("客户要用 Inceptor 湖仓集版做批流一体", knowledgeBase.aliases).includes(
      "TDH 湖仓集一体版",
    ),
  );
});

test("retrieves the real-time database and governance combination", () => {
  const result = retrieveKnowledge(
    "我想要实时流入数据库并且带有数据治理，应当怎么搭配？",
    knowledgeBase,
  );

  assert.ok(["CP-M003", "CP-M013"].includes(result.hits[0]?.entry.id ?? ""));
  assert.match(result.hits[0]?.entry.primaryRecommendation ?? "", /ArgoDB AP/);
  assert.match(result.hits[0]?.entry.primaryRecommendation ?? "", /TDS-SUITE-D/);
});

test("retrieves the Astro and professional governance responsibility boundary", () => {
  const result = retrieveKnowledge("Astro 是否能够进行实时的数据治理？", knowledgeBase);
  const ids = result.hits.map((hit) => hit.entry.id);

  assert.ok(ids.includes("CP-M021"));
});

test("does not classify pending knowledge as confirmed evidence", () => {
  const result = retrieveKnowledge("客户需要企业级数据湖", knowledgeBase);
  assert.ok(result.hits.length > 0);
  assert.equal(result.hasReliableEvidence, false);
  assert.equal(
    retrieveKnowledge("客户需要企业级数据湖", knowledgeBase, { confirmedOnly: true }).hits.length,
    0,
  );
});

test("runs all 200 synthetic questions with auditable top-three results", () => {
  const tdhQuestions = readCsv("docs/knowledge/TDH_SYNTHETIC_TEST_QUESTIONS_100.csv");
  const combinationQuestions = readCsv(
    "docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv",
  );

  let matched = 0;
  let auditable = 0;
  for (const row of tdhQuestions) {
    const hits = retrieveKnowledge(row["模拟销售提问"] ?? "", knowledgeBase).hits;
    if (hits.length > 0 && hits.every((hit) => hit.entry.sources.length > 0)) {
      auditable += 1;
    }
    const expectedMappings = (row["对应映射"] ?? "").split("；").filter(Boolean);
    if (hits.some((hit) => expectedMappings.includes(hit.entry.title))) {
      matched += 1;
    }
  }
  for (const row of combinationQuestions) {
    const hits = retrieveKnowledge(row["模拟销售提问"] ?? "", knowledgeBase).hits;
    if (hits.length > 0 && hits.every((hit) => hit.entry.sources.length > 0)) {
      auditable += 1;
    }
    const expectedMappings = (row["命中组合映射"] ?? "").split("；").filter(Boolean);
    if (hits.some((hit) => expectedMappings.includes(hit.entry.id))) {
      matched += 1;
    }
  }

  assert.equal(tdhQuestions.length + combinationQuestions.length, 200);
  assert.equal(auditable, 200);
  assert.ok(matched >= 160, `expected at least 160 top-three mapping matches, received ${matched}`);
});
