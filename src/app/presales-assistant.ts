import type { KnowledgeMode } from "../config.js";
import { knownProductNames } from "../knowledge/product-names.js";
import { retrieveKnowledge } from "../knowledge/retriever.js";
import type { KnowledgeBase, RetrievalHit } from "../knowledge/types.js";
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

export class PresalesAssistant {
  private readonly logger: AuditLogger;
  private readonly knowledgeMode: KnowledgeMode;
  private readonly now: () => number;

  constructor(private readonly options: AssistantOptions) {
    this.logger = options.logger ?? new NoopAuditLogger();
    this.knowledgeMode = options.knowledgeMode ?? "experimental";
    this.now = options.now ?? Date.now;
  }

  async answerQuestion(question: string, requestId: string = createRequestId()): Promise<AnswerResult> {
    const startedAt = this.now();
    const scope = classifyQuestionScope(question);
    if (scope !== "allowed") {
      return this.finish({
        requestId,
        question,
        startedAt,
        status: "refused",
        message: scopeMessage(scope),
        hits: [],
        errorCode: scope,
      });
    }

    const retrieval = retrieveKnowledge(question, this.options.knowledgeBase);
    const hits = evidenceForMode(retrieval.hits, this.knowledgeMode);
    if (hits.length === 0) {
      return this.finish({
        requestId,
        question,
        startedAt,
        status: "no_evidence",
        message: safeNoEvidenceMessage(),
        hits,
        errorCode: "no_evidence",
      });
    }

    try {
      let answer = await this.options.model.complete(buildGroundedRequest(question, hits));
      let validation = validateAnswer(answer, hits, {
        knownProductNames: [...knownProductNames],
      });

      if (!validation.valid) {
        answer = await this.options.model.complete(
          buildRepairRequest(question, hits, answer, validation.errors),
        );
        validation = validateAnswer(answer, hits, {
          knownProductNames: [...knownProductNames],
        });
      }

      if (!validation.valid) {
        return this.finish({
          requestId,
          question,
          startedAt,
          status: "validation_error",
          message: safeValidationFailureMessage(),
          hits,
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
      });
    } catch {
      return this.finish({
        requestId,
        question,
        startedAt,
        status: "model_error",
        message: safeModelFailureMessage(),
        hits,
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
    };
  }
}
