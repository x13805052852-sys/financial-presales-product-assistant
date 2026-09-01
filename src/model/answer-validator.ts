import { normalizeText } from "../knowledge/normalize.js";
import type { RetrievalHit } from "../knowledge/types.js";
import {
  answerFrameworks,
  defaultAnswerFramework,
  type AnswerFrameworkId,
} from "./answer-framework.js";

export interface AnswerValidationOptions {
  knownProductNames?: string[];
  frameworkId?: AnswerFrameworkId;
}

export interface AnswerValidationResult {
  valid: boolean;
  errors: string[];
  unsupportedProducts: string[];
}

function withoutMarkdownEmphasis(answer: string): string {
  return answer.replaceAll("**", "").trim();
}

function evidenceText(hits: RetrievalHit[]): string {
  return hits
    .flatMap((hit) => [
      hit.entry.primaryRecommendation,
      hit.entry.optionalRecommendation,
      hit.entry.responsibilities,
      hit.entry.title,
      ...hit.entry.capabilities,
    ])
    .filter(Boolean)
    .join("；");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function headingOccurrences(answer: string, heading: string): number {
  const pattern = new RegExp(`^\\s*${escapeRegExp(heading)}\\s*[：:]`, "gmu");
  return [...answer.matchAll(pattern)].length;
}

export function validateAnswer(
  answer: string,
  hits: RetrievalHit[],
  options: AnswerValidationOptions = {},
): AnswerValidationResult {
  const errors: string[] = [];
  const normalizedAnswer = normalizeText(answer);
  const plainAnswer = withoutMarkdownEmphasis(answer);
  const framework = answerFrameworks[options.frameworkId ?? defaultAnswerFramework];

  for (const heading of framework.requiredHeadings) {
    const pattern = new RegExp(`^\\s*${heading}\\s*[：:]\\s*\\S+`, "mu");
    if (!pattern.test(plainAnswer)) {
      errors.push(`missing or empty section: ${heading}`);
    }
  }

  const allFrameworkHeadings = [
    ...framework.requiredHeadings,
    ...framework.optionalHeadings,
    ...framework.forbiddenHeadings,
  ];
  for (const heading of new Set(allFrameworkHeadings)) {
    const occurrences = headingOccurrences(plainAnswer, heading);
    if (occurrences > 1) {
      errors.push(`duplicate section: ${heading}`);
    }
  }

  for (const heading of framework.forbiddenHeadings) {
    if (headingOccurrences(plainAnswer, heading) > 0) {
      errors.push(`forbidden section for ${framework.id}: ${heading}`);
    }
  }

  if (hits.length === 0) {
    errors.push("answer has no retrieval evidence");
  }

  const normalizedEvidence = normalizeText(evidenceText(hits));
  const unsupportedProducts = (options.knownProductNames ?? [])
    .filter((product) => normalizeText(product).length >= 3)
    .filter((product) => normalizedAnswer.includes(normalizeText(product)))
    .filter((product) => !normalizedEvidence.includes(normalizeText(product)));

  if (unsupportedProducts.length > 0) {
    errors.push(`unsupported products: ${unsupportedProducts.join(", ")}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    unsupportedProducts,
  };
}

export function safeModelFailureMessage(): string {
  return "服务暂时不可用，请稍后重试。";
}

export function safeNoEvidenceMessage(
  frameworkId: AnswerFrameworkId = defaultAnswerFramework,
): string {
  if (frameworkId === "product_overview") {
    return "当前知识库暂无足够依据，暂时无法完整说明该产品功能，请补充产品版本或联系产品专家确认。";
  }
  if (frameworkId === "risk_explanation") {
    return "当前知识库暂无足够依据核实这项资料冲突，请补充具体资料或联系产品专家确认。";
  }
  return "当前知识库暂无足够依据，暂时无法确定产品组合，请补充客户场景或联系产品专家确认。";
}

export function safeValidationFailureMessage(
  frameworkId: AnswerFrameworkId = defaultAnswerFramework,
): string {
  if (frameworkId === "product_overview") {
    return "回答未通过产品依据校验，暂时无法可靠说明该产品功能，请联系产品专家确认。";
  }
  if (frameworkId === "risk_explanation") {
    return "回答未通过资料依据校验，暂时无法可靠解释这项冲突，请联系产品专家确认。";
  }
  return "回答未通过产品依据校验，暂时无法给出推荐，请联系产品专家确认。";
}
