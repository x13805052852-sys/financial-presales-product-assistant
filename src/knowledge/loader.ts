import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parse } from "csv-parse/sync";

import { splitCapabilities, splitList } from "./normalize.js";
import type { KnowledgeBase, KnowledgeEntry, ProductAlias } from "./types.js";

type CsvRow = Record<string, string>;

function readCsv(path: string): CsvRow[] {
  const content = readFileSync(path, "utf8");
  return parse(content, {
    bom: true,
    columns: (headers: string[]) => headers.map((header) => header.trim()),
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as CsvRow[];
}

function value(row: CsvRow, key: string): string {
  return row[key]?.trim() ?? "";
}

function loadAliases(path: string): ProductAlias[] {
  return readCsv(path).map((row) => ({
    canonicalName: value(row, "标准名称"),
    entityType: value(row, "实体类型"),
    parent: value(row, "所属对象"),
    aliases: splitList(value(row, "可识别别名")),
    forbiddenMixes: splitList(value(row, "禁止混用")),
    usageRule: value(row, "首版使用规则"),
    source: value(row, "资料来源"),
    reviewStatus: value(row, "确认状态"),
  }));
}

function loadCapabilityEntries(path: string): KnowledgeEntry[] {
  return readCsv(path).map((row, index) => ({
    id: `TDH-M${String(index + 1).padStart(3, "0")}`,
    kind: "capability",
    title: value(row, "标准功能"),
    customerNeed: value(row, "客户原始需求"),
    capabilities: splitCapabilities(value(row, "标准功能")),
    solution: value(row, "解决方案"),
    primaryRecommendation: value(row, "主推产品"),
    optionalRecommendation: value(row, "可选产品"),
    responsibilities: "",
    reason: value(row, "推荐理由"),
    applicability: value(row, "适用条件"),
    clarification: "",
    exclusions: value(row, "排除条件"),
    sources: splitList(value(row, "资料来源")),
    reviewStatus: value(row, "确认人"),
    confidence: "",
  }));
}

function loadCombinationEntries(path: string): KnowledgeEntry[] {
  return readCsv(path).map((row) => ({
    id: value(row, "映射编号"),
    kind: "combination",
    title: value(row, "销售复合需求"),
    customerNeed: value(row, "销售复合需求"),
    capabilities: splitCapabilities(value(row, "能力拆分")),
    solution: "",
    primaryRecommendation: value(row, "主推组合"),
    optionalRecommendation: value(row, "可选组合"),
    responsibilities: value(row, "产品分工"),
    reason: "",
    applicability: value(row, "适用条件"),
    clarification: value(row, "必须追问"),
    exclusions: value(row, "排除条件"),
    sources: splitList(value(row, "资料来源")),
    reviewStatus: value(row, "审核状态"),
    confidence: value(row, "推荐置信度"),
  }));
}

export function loadKnowledgeBase(repositoryRoot: string = process.cwd()): KnowledgeBase {
  const knowledgeDirectory = join(repositoryRoot, "docs", "knowledge");
  const aliases = loadAliases(join(knowledgeDirectory, "TDH_PRODUCT_ALIASES.csv"));
  const capabilityEntries = loadCapabilityEntries(
    join(knowledgeDirectory, "TDH_CAPABILITY_PRODUCT_MAPPING.csv"),
  );
  const combinationEntries = loadCombinationEntries(
    join(knowledgeDirectory, "CROSS_PRODUCT_COMBINATION_MAPPING.csv"),
  );

  return {
    aliases,
    entries: [...combinationEntries, ...capabilityEntries],
  };
}
