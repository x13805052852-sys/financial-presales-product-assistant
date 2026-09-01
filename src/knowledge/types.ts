export type KnowledgeKind = "capability" | "combination";

export interface ProductAlias {
  canonicalName: string;
  entityType: string;
  parent: string;
  aliases: string[];
  forbiddenMixes: string[];
  usageRule: string;
  source: string;
  reviewStatus: string;
}

export interface KnowledgeEntry {
  id: string;
  kind: KnowledgeKind;
  title: string;
  customerNeed: string;
  capabilities: string[];
  solution: string;
  primaryRecommendation: string;
  optionalRecommendation: string;
  responsibilities: string;
  reason: string;
  applicability: string;
  clarification: string;
  exclusions: string;
  sources: string[];
  reviewStatus: string;
  confidence: string;
}

export interface KnowledgeBase {
  aliases: ProductAlias[];
  entries: KnowledgeEntry[];
}

export interface RetrievalHit {
  entry: KnowledgeEntry;
  score: number;
  matchedTerms: string[];
  isConfirmed: boolean;
}

export interface RetrievalResult {
  normalizedQuestion: string;
  recognizedProducts: string[];
  hits: RetrievalHit[];
  hasReliableEvidence: boolean;
}
