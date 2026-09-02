import { knownProductNames } from "../knowledge/product-names.js";
import { normalizeText } from "../knowledge/normalize.js";
import type { ContextDecision, ContextSnapshot } from "./types.js";

interface ResolveContextInput {
  question: string;
  currentSessionKeyHash: string;
  previous?: ContextSnapshot;
  quoteText?: string;
  unsafe?: boolean;
  now?: number;
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1_000;
const FOLLOW_UP_THRESHOLD = 4;

const conceptTerms: Record<string, string[]> = {
  realtime: ["实时", "流式", "秒级", "亚秒", "毫秒", "分钟级", "持续同步"],
  governance: ["治理", "目录", "质量", "分类分级", "敏感数据", "数据标准"],
  transaction: ["事务", "交易", "oltp", "htap", "crm", "erp", "强一致"],
  lake: ["数据湖", "湖仓", "入湖", "hadoop", "cdh"],
  service: ["数据服务", "接口", "api", "对外提供"],
  intelligence: ["智能体", "智能治理", "自动识别", "智能助手"],
};

const continuationPattern = /^(?:所以|那么|那|这个|这种|它|其|上述|刚才|为什么|具体|详细|正常)/u;
const retryPattern = /^(?:再|重新)(?:试|查|回答|来)|重试/u;

function includesNormalized(haystack: string, needle: string): boolean {
  const normalizedNeedle = normalizeText(needle);
  return normalizedNeedle.length >= 2 && normalizeText(haystack).includes(normalizedNeedle);
}

function matchingQuote(quoteText: string | undefined, previous: ContextSnapshot): boolean {
  const quote = normalizeText(quoteText ?? "");
  if (quote.length < 2) {
    return false;
  }

  return [
    previous.question,
    previous.resolvedQuestion,
    previous.answerSummary,
    ...previous.products,
    ...previous.recommendations,
  ].some((value) => {
    const candidate = normalizeText(value);
    return candidate.length >= 2 && (candidate.includes(quote) || quote.includes(candidate));
  });
}

function productsIn(value: string): string[] {
  return [...knownProductNames]
    .sort((left, right) => right.length - left.length)
    .filter((product) => includesNormalized(value, product));
}

function productOverlap(questionProducts: string[], previousProducts: string[]): boolean {
  return questionProducts.some((questionProduct) =>
    previousProducts.some((previousProduct) => {
      const questionName = normalizeText(questionProduct);
      const previousName = normalizeText(previousProduct);
      return questionName.includes(previousName) || previousName.includes(questionName);
    }),
  );
}

function conceptsIn(value: string): string[] {
  const normalized = normalizeText(value);
  return Object.entries(conceptTerms)
    .filter(([, terms]) => terms.some((term) => normalized.includes(normalizeText(term))))
    .map(([concept]) => concept);
}

function hasOverlap(question: string, previous: ContextSnapshot): boolean {
  const questionProducts = productsIn(question);
  if (productOverlap(questionProducts, previous.products)) {
    return true;
  }

  const questionConcepts = new Set(conceptsIn(question));
  const previousConcepts = conceptsIn(
    [
      previous.question,
      previous.resolvedQuestion,
      ...previous.capabilities,
      ...previous.recommendations,
    ].join("；"),
  );
  return previousConcepts.some((concept) => questionConcepts.has(concept));
}

function hasOmittedSubject(question: string): boolean {
  const normalized = normalizeText(question);
  if (!normalized) {
    return false;
  }
  if (productsIn(question).length > 0) {
    return false;
  }
  return continuationPattern.test(question.trim()) || question.trim().endsWith("呢") || normalized.length <= 9;
}

export function resolveContext(input: ResolveContextInput): ContextDecision {
  if (!input.previous) {
    return { followUp: false, score: 0, matchedRules: [], reason: "no_previous_turn" };
  }
  if (input.unsafe) {
    return { followUp: false, score: 0, matchedRules: [], reason: "unsafe" };
  }
  if (input.previous.sessionKeyHash !== input.currentSessionKeyHash) {
    return { followUp: false, score: 0, matchedRules: [], reason: "identity_mismatch" };
  }

  const now = input.now ?? Date.now();
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  if (now - input.previous.createdAt >= ttlMs) {
    return { followUp: false, score: 0, matchedRules: [], reason: "expired" };
  }

  const question = input.question.trim();
  const matchedRules: string[] = [];
  let score = 0;
  const quoteMatches = matchingQuote(input.quoteText, input.previous);
  if (quoteMatches) {
    score += 4;
    matchedRules.push("matching_quote");
  }

  if (retryPattern.test(question) && input.previous.status === "retryable_error") {
    score += 3;
    matchedRules.push("retry_request");
  }

  if (continuationPattern.test(question) || question.endsWith("呢")) {
    score += 3;
    matchedRules.push("continuation_cue");
  }

  if (hasOmittedSubject(question)) {
    score += 2;
    matchedRules.push("omitted_subject");
  }

  const overlap = hasOverlap(question, input.previous);
  if (overlap) {
    score += 2;
    matchedRules.push("topic_overlap");
  }

  if (now - input.previous.createdAt <= 5 * 60 * 1_000) {
    score += 1;
    matchedRules.push("recent_turn");
  }

  const currentProducts = productsIn(question);
  const differentProduct =
    currentProducts.length > 0 && !productOverlap(currentProducts, input.previous.products);
  if (differentProduct) {
    score -= 4;
    matchedRules.push("different_product");
  }

  if (!overlap && !quoteMatches) {
    score -= 2;
    matchedRules.push("no_topic_overlap");
  }

  const followUp = score >= FOLLOW_UP_THRESHOLD;
  return {
    followUp,
    score,
    matchedRules,
    reason: followUp ? "follow_up" : "new_question",
  };
}
