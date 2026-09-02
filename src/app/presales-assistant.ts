import type { KnowledgeMode } from "../config.js";
import type { ContextDecision, GroundingSummary } from "../context/types.js";
import { normalizeText } from "../knowledge/normalize.js";
import { knownProductNames } from "../knowledge/product-names.js";
import { retrieveKnowledge } from "../knowledge/retriever.js";
import type {
  KnowledgeBase,
  RetrievalHit,
  RetrievalResult,
} from "../knowledge/types.js";
import {
  classifyAnswerFramework,
  type AnswerFrameworkId,
} from "../model/answer-framework.js";
import {
  safeModelFailureMessage,
  safeNoEvidenceMessage,
  safeValidationFailureMessage,
  validateAnswer,
} from "../model/answer-validator.js";
import { buildGroundedRequest, buildRepairRequest } from "../model/prompt.js";
import type { ChatModel } from "../model/types.js";
import {
  createAuditEvent,
  createRequestId,
  NoopAuditLogger,
  type AuditLogger,
  type ContextAuditMetadata,
} from "./audit-logger.js";
import { classifyQuestionScope, scopeMessage } from "./scope.js";

export type AnswerStatus =
  | "answered"
  | "refused"
  | "no_evidence"
  | "model_error"
  | "validation_error";

export interface AnswerResult {
  requestId: string;
  status: AnswerStatus;
  message: string;
  knowledgeIds: string[];
  sources: string[];
  elapsedMs: number;
  experimental: boolean;
  answerFramework?: AnswerFrameworkId;
  groundingSummary?: GroundingSummary;
  contextDecision?: ContextDecision;
}

interface AssistantOptions {
  knowledgeBase: KnowledgeBase;
  model: ChatModel;
  modelName: string;
  knowledgeMode?: KnowledgeMode;
  logger?: AuditLogger;
  now?: () => number;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function evidenceForMode(hits: RetrievalHit[], mode: KnowledgeMode): RetrievalHit[] {
  return mode === "production" ? hits.filter((hit) => hit.isConfirmed) : hits;
}

function buildGroundingSummary(
  retrieval: RetrievalResult,
  hits: RetrievalHit[],
): GroundingSummary {
  const recommendations = unique(
    hits.flatMap((hit) => [
      hit.entry.primaryRecommendation,
      hit.entry.optionalRecommendation,
    ]),
  );
  const evidenceText = hits
    .flatMap((hit) => [
      hit.entry.title,
      hit.entry.primaryRecommendation,
      hit.entry.optionalRecommendation,
      hit.entry.responsibilities,
    ])
    .join("；");
  const normalizedEvidence = normalizeText(evidenceText);
  const products = unique([
    ...retrieval.recognizedProducts,
    ...knownProductNames.filter((product) =>
      normalizedEvidence.includes(normalizeText(product)),
    ),
  ]);
  const capabilities = unique(hits.flatMap((hit) => hit.entry.capabilities)).slice(0, 12);

  return {
    normalizedQuestion: retrieval.normalizedQuestion,
    topicLabel: hits[0]?.entry.title || products[0] || "产品问题",
    products,
    capabilities,
    recommendations,
    knowledgeIds: hits.map((hit) => hit.entry.id),
  };
}

export class PresalesAssistant {
  private readonly logger: AuditLogger;
  private readonly knowledgeMode: KnowledgeMode;
  private readonly now: () => number;

  constructor(private readonly options: AssistantOptions) {
    this.logger = options.logger ?? new NoopAuditLogger();
    this.knowledgeMode = options.knowledgeMode ?? "experimental";
    this.now = options.now ?? Date.now;
  }

  async answerQuestion(
    question: string,
    requestId: string = createRequestId(),
    contextAudit?: ContextAuditMetadata,
  ): Promise<AnswerResult> {
    const startedAt = this.now();
    const contextFields = contextAudit ? { contextAudit } : {};
    const scope = classifyQuestionScope(question);
    if (scope !== "allowed") {
      return this.finish({
        requestId,
        question,
        startedAt,
        status: "refused",
        message: scopeMessage(scope),
        hits: [],
        ...contextFields,
        errorCode: scope,
      });
    }

    const answerFramework = classifyAnswerFramework(question);
    const retrieval = retrieveKnowledge(question, this.options.knowledgeBase);
    const hits = evidenceForMode(retrieval.hits, this.knowledgeMode);
    const groundingSummary = buildGroundingSummary(retrieval, hits);
    if (hits.length === 0) {
      return this.finish({
        requestId,
        question,
        startedAt,
        status: "no_evidence",
        message: safeNoEvidenceMessage(answerFramework),
        hits,
        answerFramework,
        groundingSummary,
        ...contextFields,
        errorCode: "no_evidence",
      });
    }

    try {
      let answer = await this.options.model.complete(
        buildGroundedRequest(question, hits, answerFramework),
      );
      let validation = validateAnswer(answer, hits, {
        knownProductNames: [...knownProductNames],
        frameworkId: answerFramework,
      });

      if (!validation.valid) {
        answer = await this.options.model.complete(
          buildRepairRequest(question, hits, answer, validation.errors, answerFramework),
        );
        validation = validateAnswer(answer, hits, {
          knownProductNames: [...knownProductNames],
          frameworkId: answerFramework,
        });
      }

      if (!validation.valid) {
        return this.finish({
          requestId,
          question,
          startedAt,
          status: "validation_error",
          message: safeValidationFailureMessage(answerFramework),
          hits,
          answerFramework,
          groundingSummary,
          ...contextFields,
          errorCode: "answer_validation_failed",
        });
      }

      return this.finish({
        requestId,
        question,
        startedAt,
        status: "answered",
        message: answer,
        hits,
        answerFramework,
        groundingSummary,
        ...contextFields,
      });
    } catch {
      return this.finish({
        requestId,
        question,
        startedAt,
        status: "model_error",
        message: safeModelFailureMessage(),
        hits,
        answerFramework,
        groundingSummary,
        ...contextFields,
        errorCode: "model_request_failed",
      });
    }
  }

  private async finish(input: {
    requestId: string;
    question: string;
    startedAt: number;
    status: AnswerStatus;
    message: string;
    hits: RetrievalHit[];
    answerFramework?: AnswerFrameworkId;
    groundingSummary?: GroundingSummary;
    contextAudit?: ContextAuditMetadata;
    errorCode?: string;
  }): Promise<AnswerResult> {
    const elapsedMs = Math.max(0, this.now() - input.startedAt);
    const knowledgeIds = input.hits.map((hit) => hit.entry.id);
    const sources = unique(input.hits.flatMap((hit) => hit.entry.sources));
    const event = createAuditEvent({
      requestId: input.requestId,
      question: input.question,
      status: input.status,
      knowledgeIds,
      model: this.options.modelName,
      elapsedMs,
      ...(input.answerFramework ? { answerFramework: input.answerFramework } : {}),
      ...(input.contextAudit ?? {}),
      ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    });
    await this.logger.write(event);

    return {
      requestId: input.requestId,
      status: input.status,
      message: input.message,
      knowledgeIds,
      sources,
      elapsedMs,
      experimental: this.knowledgeMode === "experimental",
      ...(input.answerFramework ? { answerFramework: input.answerFramework } : {}),
      ...(input.groundingSummary ? { groundingSummary: input.groundingSummary } : {}),
    };
  }
}
