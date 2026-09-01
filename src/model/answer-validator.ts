import { normalizeText } from "../knowledge/normalize.js";
import type { RetrievalHit } from "../knowledge/types.js";

export interface AnswerValidationOptions {
  knownProductNames?: string[];
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

export function validateAnswer(
  answer: string,
  hits: RetrievalHit[],
  options: AnswerValidationOptions = {},
): AnswerValidationResult {
  const errors: string[] = [];
  const normalizedAnswer = normalizeText(answer);
  const plainAnswer = withoutMarkdownEmphasis(answer);

  for (const heading of ["结论", "推荐组合", "产品分工"]) {
    const pattern = new RegExp(`^\\s*${heading}\\s*[：:]\\s*\\S+`, "mu");
    if (!pattern.test(plainAnswer)) {
      errors.push(`missing or empty section: ${heading}`);
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

export function safeNoEvidenceMessage(): string {
  return "当前知识库暂无足够依据，暂时无法确定产品组合，请补充客户场景或联系产品专家确认。";
}
