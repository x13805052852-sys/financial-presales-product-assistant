import type { ContextDecision, ContextSnapshot } from "./types.js";

export interface ResolvedQuestion {
  resolvedQuestion: string;
  contextBanner?: string;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function redactSummary(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[邮箱]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[手机号]")
    .replace(/\b(?:AQ\.|sk-)[A-Za-z0-9._-]+/g, "[密钥]")
    .replace(/\d+(?:\.\d+)?\s*(?:万|亿)?元/gu, "[金额]")
    .replace(/\s+/gu, " ")
    .trim();
}

export function buildContextBanner(previous: ContextSnapshot): string | undefined {
  const safeSummary = redactSummary(previous.answerSummary);
  if (!safeSummary) {
    return undefined;
  }
  return `承接上一问：${Array.from(safeSummary).slice(0, 20).join("")}`;
}

export function resolveQuestion(
  question: string,
  previous: ContextSnapshot,
  decision: ContextDecision,
): ResolvedQuestion {
  const normalizedQuestion = question.trim();
  if (!decision.followUp) {
    return { resolvedQuestion: normalizedQuestion };
  }

  if (decision.matchedRules.includes("retry_request")) {
    const contextBanner = buildContextBanner(previous);
    return {
      resolvedQuestion: previous.resolvedQuestion,
      ...(contextBanner ? { contextBanner } : {}),
    };
  }

  const products = unique([...previous.products, ...previous.recommendations]);
  const capabilities = unique(previous.capabilities);
  const sections = [
    `上一轮客户需求：${previous.question}`,
    products.length > 0 ? `上一轮产品与组合：${products.join("；")}` : "",
    capabilities.length > 0 ? `上一轮能力：${capabilities.join("；")}` : "",
    `当前追问：${normalizedQuestion}`,
    "请仅针对当前追问回答，并重新依据知识资料确认结论。",
  ].filter(Boolean);
  const contextBanner = buildContextBanner(previous);

  return {
    resolvedQuestion: sections.join("\n"),
    ...(contextBanner ? { contextBanner } : {}),
  };
}
