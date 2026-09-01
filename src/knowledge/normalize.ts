import type { ProductAlias } from "./types.js";

export function normalizeText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function splitList(value: string): string[] {
  return value
    .split(/[;；、，,。\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitCapabilities(value: string): string[] {
  return value
    .split(/[;；、，,。\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function recognizeProducts(question: string, aliases: ProductAlias[]): string[] {
  const normalizedQuestion = normalizeText(question);
  const recognized = new Set<string>();

  for (const product of aliases) {
    const candidates = [product.canonicalName, ...product.aliases];
    if (
      candidates.some((candidate) => {
        const normalizedCandidate = normalizeText(candidate);
        return normalizedCandidate.length >= 2 && normalizedQuestion.includes(normalizedCandidate);
      })
    ) {
      recognized.add(product.canonicalName);
    }
  }

  return [...recognized];
}
