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
    70,
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
  assert.ok(
    recognizeProducts("词元工厂需要按SLA路由模型", knowledgeBase.aliases).includes(
      "TokenFactory",
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

test("retrieves the LLMOps multi-model service and Token operations combination", () => {
  const result = retrieveKnowledge(
    "客户有多个私有和外部模型，希望统一接入并按SLA和成本路由，还要统计Token用量。",
    knowledgeBase,
  );
  const ids = result.hits.map((hit) => hit.entry.id);

  assert.ok(ids.includes("LLM-M003"), ids.join(","));
});

test("retrieves the LLMOps high-quality RAG knowledge combination", () => {
  const result = retrieveKnowledge(
    "客户要把多源文档持续加工成有来源、有版本、可复测的高质量RAG知识库。",
    knowledgeBase,
  );
  const ids = result.hits.map((hit) => hit.entry.id);

  assert.ok(ids.includes("LLM-M007"), ids.join(","));
});

test("retrieves the LLMOps expert digital employee combination", () => {
  const result = retrieveKnowledge(
    "客户要把专家岗位做成能使用企业知识和工具、可以人工接管的数字员工。",
    knowledgeBase,
  );
  const ids = result.hits.map((hit) => hit.entry.id);

  assert.ok(ids.includes("LLM-M001") || ids.includes("LLM-M009"), ids.join(","));
});

test("retrieves WUYA knowledge question answering", () => {
  const result = retrieveKnowledge(
    "客户要用内部文档建设能引用原文的企业知识问答，应该选择什么？",
    knowledgeBase,
  );
  assert.ok(result.hits.some((hit) => hit.entry.id === "WUYA-M001"));
});

test("retrieves WUYA governed natural-language data analysis", () => {
  const result = retrieveKnowledge(
    "客户已有TDS的数据指标和治理成果，希望业务人员自然语言问数并生成图表。",
    knowledgeBase,
  );
  assert.ok(result.hits.some((hit) => hit.entry.id === "WUYA-M005"));
});

test("retrieves Co-Worker with WUYA knowledge for task execution", () => {
  const result = retrieveKnowledge(
    "客户既要查企业知识，又要进入ERP和OA完成催办流程。",
    knowledgeBase,
  );
  assert.ok(result.hits.some((hit) => hit.entry.id === "WUYA-M007"));
});

test("runs all 400 synthetic questions with auditable top-three results", () => {
  const tdhQuestions = readCsv("docs/knowledge/TDH_SYNTHETIC_TEST_QUESTIONS_100.csv");
  const combinationQuestions = readCsv(
    "docs/knowledge/CROSS_PRODUCT_SYNTHETIC_TEST_QUESTIONS_100.csv",
  );
  const llmopsQuestions = readCsv(
    "docs/knowledge/LLMOPS_SYNTHETIC_TEST_QUESTIONS_100.csv",
  );
  const wuyaQuestions = readCsv(
    "docs/knowledge/WUYA_SYNTHETIC_TEST_QUESTIONS_100.csv",
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

  let llmopsAuditable = 0;
  let llmopsMatched = 0;
  let llmopsExpected = 0;
  for (const row of llmopsQuestions) {
    const hits = retrieveKnowledge(row["模拟销售提问"] ?? "", knowledgeBase).hits;
    if (hits.length > 0 && hits.every((hit) => hit.entry.sources.length > 0)) {
      llmopsAuditable += 1;
    }
    const expectedMapping = row["对应映射"] ?? "";
    if (expectedMapping !== "安全边界（无产品映射）") {
      llmopsExpected += 1;
      if (hits.some((hit) => hit.entry.title === expectedMapping)) {
        llmopsMatched += 1;
      }
    }
  }

  assert.equal(tdhQuestions.length + combinationQuestions.length, 200);
  assert.equal(auditable, 200);
  assert.ok(matched >= 160, `expected at least 160 top-three mapping matches, received ${matched}`);
  assert.equal(llmopsQuestions.length, 100);
  assert.equal(llmopsAuditable, 100);
  assert.ok(
    llmopsMatched / llmopsExpected >= 0.9,
    `expected at least 90% LLMOps mapping matches, received ${llmopsMatched}/${llmopsExpected}`,
  );

  let wuyaAuditable = 0;
  let wuyaMatched = 0;
  let wuyaExpected = 0;
  for (const row of wuyaQuestions) {
    const hits = retrieveKnowledge(row["模拟销售提问"] ?? "", knowledgeBase).hits;
    if (hits.length > 0 && hits.every((hit) => hit.entry.sources.length > 0)) {
      wuyaAuditable += 1;
    }
    const expectedMapping = row["对应映射"] ?? "";
    if (expectedMapping !== "安全边界（无产品映射）") {
      wuyaExpected += 1;
      if (hits.some((hit) => hit.entry.title === expectedMapping)) {
        wuyaMatched += 1;
      }
    }
  }
  assert.equal(wuyaQuestions.length, 100);
  assert.equal(wuyaAuditable, 100);
  assert.ok(
    wuyaMatched / wuyaExpected >= 0.9,
    `expected at least 90% WUYA mapping matches, received ${wuyaMatched}/${wuyaExpected}`,
  );
});
