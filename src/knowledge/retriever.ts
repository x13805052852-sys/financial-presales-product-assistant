import { normalizeText, recognizeProducts } from "./normalize.js";
import type {
  KnowledgeBase,
  KnowledgeEntry,
  RetrievalHit,
  RetrievalResult,
} from "./types.js";

export interface RetrievalOptions {
  topK?: number;
  minimumScore?: number;
  confirmedOnly?: boolean;
}

const conceptTerms: Record<string, string[]> = {
  realtime: ["实时", "流式", "秒级", "亚秒", "分钟级", "持续同步"],
  governance: ["治理", "目录", "质量", "分类分级", "敏感数据", "数据标准"],
  transaction: ["事务", "交易", "oltp", "htap", "crm", "erp", "单条更新", "强一致"],
  lake: ["数据湖", "湖仓", "入湖", "hadoop", "cdh"],
  service: ["数据服务", "接口", "api", "对外提供"],
  intelligence: ["astro", "智能体", "智能治理", "自动识别", "智能助手"],
  corpus: ["语料", "标注", "数据集", "问答对", "多模态", "清洗", "去重"],
  modelOperations: ["模型", "微调", "训练", "评测", "推理", "token", "算力", "gpu"],
  knowledgeEngineering: ["知识库", "知识工程", "rag", "检索", "索引", "业务本体"],
  agentEngineering: ["agent", "数字员工", "vibe coding", "agentbox", "会话", "人工接管"],
  aiGovernance: ["catalog", "discover", "权限", "审计", "workspace", "secret", "资产"],
};

const explicitProducts = [
  "TDH",
  "ArgoDB",
  "TDS",
  "Astro",
  "TDC",
  "LLMOps",
  "TKH",
  "Scope",
  "Corpus Studio",
  "Model Foundry",
  "TokenFactory",
  "Knowledge Lodge",
  "Agent Go",
  "AI Infra",
  "AgentBox",
  "Agent Buddy",
  "Agent Session Manager",
  "KB Agent",
  "Catalog",
  "Discover",
];

function isConfirmed(entry: KnowledgeEntry): boolean {
  return entry.reviewStatus.includes("已确认") && !entry.reviewStatus.includes("待");
}

function repeat(value: string, count: number): string[] {
  return value ? Array.from({ length: count }, () => value) : [];
}

function entrySearchText(entry: KnowledgeEntry): string {
  return [
    ...repeat(entry.title, 4),
    ...repeat(entry.customerNeed, 2),
    ...entry.capabilities.flatMap((capability) => repeat(capability, 4)),
    ...repeat(entry.solution, 2),
    ...repeat(entry.primaryRecommendation, 2),
    entry.optionalRecommendation,
    entry.responsibilities,
    entry.reason,
    entry.applicability,
    entry.clarification,
    entry.exclusions,
  ]
    .filter(Boolean)
    .join("；");
}

function entryCoreText(entry: KnowledgeEntry): string {
  return [
    entry.title,
    entry.customerNeed,
    ...entry.capabilities,
    entry.solution,
    entry.primaryRecommendation,
    entry.responsibilities,
    entry.reason,
    entry.applicability,
  ]
    .filter(Boolean)
    .join("；");
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value);
  const tokens: string[] = [];
  for (const size of [2, 3]) {
    if (normalized.length < size) {
      continue;
    }
    for (let index = 0; index <= normalized.length - size; index += 1) {
      tokens.push(normalized.slice(index, index + size));
    }
  }
  return tokens;
}

interface SearchDocument {
  termFrequency: Map<string, number>;
  length: number;
}

function buildSearchDocument(entry: KnowledgeEntry): SearchDocument {
  const tokens = tokenize(entrySearchText(entry));
  const termFrequency = new Map<string, number>();
  for (const token of tokens) {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
  }
  return { termFrequency, length: tokens.length };
}

function bm25Scores(question: string, entries: KnowledgeEntry[]): Map<string, number> {
  const queryTerms = new Set(tokenize(question));
  const documents = new Map(
    entries.map((entry) => [entry.id, buildSearchDocument(entry)] as const),
  );
  const averageLength =
    [...documents.values()].reduce((sum, document) => sum + document.length, 0) /
    Math.max(documents.size, 1);
  const documentFrequency = new Map<string, number>();

  for (const term of queryTerms) {
    let count = 0;
    for (const document of documents.values()) {
      if (document.termFrequency.has(term)) {
        count += 1;
      }
    }
    documentFrequency.set(term, count);
  }

  const scores = new Map<string, number>();
  const k1 = 1.5;
  const b = 0.75;
  for (const entry of entries) {
    const document = documents.get(entry.id);
    if (!document) {
      continue;
    }

    let score = 0;
    for (const term of queryTerms) {
      const frequency = document.termFrequency.get(term) ?? 0;
      if (frequency === 0) {
        continue;
      }
      const frequencyInDocuments = documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(
        1 + (entries.length - frequencyInDocuments + 0.5) / (frequencyInDocuments + 0.5),
      );
      const lengthAdjustment =
        frequency + k1 * (1 - b + b * (document.length / Math.max(averageLength, 1)));
      score += inverseDocumentFrequency * ((frequency * (k1 + 1)) / lengthAdjustment);
    }
    scores.set(entry.id, score);
  }

  return scores;
}

function containsAny(normalizedText: string, terms: string[]): boolean {
  return terms.some((term) => normalizedText.includes(normalizeText(term)));
}

function intentScore(question: string, entry: KnowledgeEntry): {
  score: number;
  matchedTerms: string[];
} {
  const normalizedQuestion = normalizeText(question);
  const normalizedEntry = normalizeText(entrySearchText(entry));
  const normalizedCoreEntry = normalizeText(entryCoreText(entry));
  const normalizedTitle = normalizeText(entry.title);
  const matchedTerms: string[] = [];
  let score = 0;

  for (const [concept, terms] of Object.entries(conceptTerms)) {
    if (containsAny(normalizedQuestion, terms) && containsAny(normalizedEntry, terms)) {
      score += 4;
      matchedTerms.push(concept);
    }
  }

  const transactionIsNegated = ["没有事务", "不需要事务", "无事务", "不是事务"].some((term) =>
    normalizedQuestion.includes(normalizeText(term)),
  );
  const questionHasTransaction =
    !transactionIsNegated && containsAny(normalizedQuestion, conceptTerms.transaction ?? []);
  const entryHasTransaction = containsAny(normalizedCoreEntry, conceptTerms.transaction ?? []);
  if (entryHasTransaction && !questionHasTransaction) {
    score -= 14;
  } else if (entryHasTransaction && questionHasTransaction) {
    score += 6;
  }

  for (const product of explicitProducts) {
    const normalizedProduct = normalizeText(product);
    if (!normalizedQuestion.includes(normalizedProduct)) {
      continue;
    }
    if (normalizedEntry.includes(normalizedProduct)) {
      score += 9;
      matchedTerms.push(product);
    } else {
      score -= 3;
    }
  }

  const asksAstroGovernanceBoundary =
    normalizedQuestion.includes("astro") &&
    containsAny(normalizedQuestion, conceptTerms.governance ?? []) &&
    containsAny(normalizedQuestion, ["是否", "能否", "可以", "能不能"]);
  if (
    asksAstroGovernanceBoundary &&
    normalizedTitle.includes(normalizeText("区分 Astro 智能治理与 TDS 专业治理工具"))
  ) {
    score += 22;
    matchedTerms.push("Astro治理边界");
  }

  const asksGenericRealtimeDatabaseGovernance =
    containsAny(normalizedQuestion, conceptTerms.realtime ?? []) &&
    containsAny(normalizedQuestion, conceptTerms.governance ?? []) &&
    containsAny(normalizedQuestion, ["数据库", "分析库", "入库"]);
  if (asksGenericRealtimeDatabaseGovernance) {
    if (
      normalizedTitle.includes(normalizeText("实时数据进入分析数据库并同时做治理")) ||
      normalizedTitle.includes(normalizeText("秒级或亚秒级分析数据库配套完整治理"))
    ) {
      score += 16;
      matchedTerms.push("实时数据库治理");
    }
    const requiresStreamProcessing = containsAny(normalizedCoreEntry, ["流式etl", "事件流清洗"]);
    const asksForStreamProcessing = containsAny(normalizedQuestion, ["清洗", "etl", "事件流", "kafka", "flink"]);
    if (requiresStreamProcessing && !asksForStreamProcessing) {
      score -= 10;
    }
  }

  return { score, matchedTerms };
}

function scoreEntry(
  question: string,
  recognizedProducts: string[],
  entry: KnowledgeEntry,
  lexicalScore: number,
): RetrievalHit {
  const normalizedQuestion = normalizeText(question);
  const matchedTerms = new Set<string>();
  const intent = intentScore(question, entry);
  let score = lexicalScore + intent.score;
  for (const term of intent.matchedTerms) {
    matchedTerms.add(term);
  }

  const title = normalizeText(entry.title);
  if (title.length >= 2 && normalizedQuestion.includes(title)) {
    score += 12;
    matchedTerms.add(entry.title);
  }

  for (const capability of entry.capabilities) {
    const normalizedCapability = normalizeText(capability);
    if (normalizedCapability.length >= 2 && normalizedQuestion.includes(normalizedCapability)) {
      score += 7;
      matchedTerms.add(capability);
    }
  }

  for (const product of recognizedProducts) {
    const normalizedProduct = normalizeText(product);
    if (normalizeText(entrySearchText(entry)).includes(normalizedProduct)) {
      score += 4;
      matchedTerms.add(product);
    }
  }

  if (entry.kind === "combination") {
    score += 0.25;
  }

  return {
    entry,
    score: Number(score.toFixed(4)),
    matchedTerms: [...matchedTerms],
    isConfirmed: isConfirmed(entry),
  };
}

export function retrieveKnowledge(
  question: string,
  knowledgeBase: KnowledgeBase,
  options: RetrievalOptions = {},
): RetrievalResult {
  const normalizedQuestion = normalizeText(question);
  if (!normalizedQuestion) {
    return {
      normalizedQuestion,
      recognizedProducts: [],
      hits: [],
      hasReliableEvidence: false,
    };
  }

  const topK = options.topK ?? 3;
  const minimumScore = options.minimumScore ?? 1.5;
  const recognizedProducts = recognizeProducts(question, knowledgeBase.aliases);
  const candidateEntries = knowledgeBase.entries.filter(
    (entry) => !options.confirmedOnly || isConfirmed(entry),
  );
  const lexicalScores = bm25Scores(question, candidateEntries);
  const hits = candidateEntries
    .map((entry) =>
      scoreEntry(question, recognizedProducts, entry, lexicalScores.get(entry.id) ?? 0),
    )
    .filter((hit) => hit.score >= minimumScore)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id))
    .slice(0, topK);

  return {
    normalizedQuestion,
    recognizedProducts,
    hits,
    hasReliableEvidence: hits.some((hit) => hit.isConfirmed),
  };
}
