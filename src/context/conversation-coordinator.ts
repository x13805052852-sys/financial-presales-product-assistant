import type { ContextAuditMetadata } from "../app/audit-logger.js";
import type { AnswerResult } from "../app/presales-assistant.js";
import { classifyQuestionScope } from "../app/scope.js";
import { resolveContext } from "./context-resolver.js";
import { OneTurnContextStore } from "./one-turn-context-store.js";
import { resolveQuestion } from "./question-resolver.js";
import { createSessionKey } from "./session-key.js";
import type {
  ContextDecision,
  ContextSnapshot,
  ConversationMessageContext,
  GroundingSummary,
} from "./types.js";

interface GroundedQuestionAnswerer {
  answerQuestion(
    question: string,
    requestId: string,
    contextAudit?: ContextAuditMetadata,
  ): Promise<AnswerResult>;
}

export interface ContextualQuestionAnswerer {
  answerQuestion(
    question: string,
    requestId: string,
    context: ConversationMessageContext,
  ): Promise<AnswerResult>;
}

interface CoordinatorOptions {
  now?: () => number;
}

function auditMetadata(decision: ContextDecision): ContextAuditMetadata {
  return {
    contextDecision: decision.followUp ? "follow_up" : "new_question",
    contextScore: decision.score,
    contextRules: decision.matchedRules,
  };
}

function snapshotFrom(
  sessionKeyHash: string,
  messageId: string,
  question: string,
  resolvedQuestion: string,
  result: AnswerResult,
  now: number,
): ContextSnapshot {
  const grounding: GroundingSummary = result.groundingSummary ?? {
    normalizedQuestion: resolvedQuestion,
    topicLabel: question.slice(0, 20),
    products: [],
    capabilities: [],
    recommendations: [],
    knowledgeIds: result.knowledgeIds,
  };
  return {
    sessionKeyHash,
    messageId,
    question,
    resolvedQuestion,
    intent: result.answerFramework ?? "solution_recommendation",
    products: grounding.products,
    capabilities: grounding.capabilities,
    recommendations: grounding.recommendations,
    knowledgeIds: grounding.knowledgeIds,
    answerSummary: grounding.topicLabel,
    status:
      result.status === "model_error" || result.status === "validation_error"
        ? "retryable_error"
        : "answered",
    createdAt: now,
  };
}

function fallbackDecision(): ContextDecision {
  return {
    followUp: false,
    score: 0,
    matchedRules: [],
    reason: "resolver_error",
  };
}

export class ConversationCoordinator {
  private readonly now: () => number;

  constructor(
    private readonly assistant: GroundedQuestionAnswerer,
    private readonly store: OneTurnContextStore,
    options: CoordinatorOptions = {},
  ) {
    this.now = options.now ?? Date.now;
  }

  async answerQuestion(
    question: string,
    requestId: string,
    context: ConversationMessageContext,
  ): Promise<AnswerResult> {
    const normalizedQuestion = question.trim();
    let sessionKeyHash: string;
    let decision: ContextDecision;
    let resolvedQuestion = normalizedQuestion;
    let contextBanner: string | undefined;

    try {
      sessionKeyHash = createSessionKey(context.identity);
      const previous = this.store.get(sessionKeyHash);
      decision = resolveContext({
        question: normalizedQuestion,
        currentSessionKeyHash: sessionKeyHash,
        ...(previous ? { previous } : {}),
        ...(context.quoteText ? { quoteText: context.quoteText } : {}),
        unsafe: classifyQuestionScope(normalizedQuestion) === "sensitive",
        now: this.now(),
      });
      if (previous && decision.followUp) {
        const resolution = resolveQuestion(normalizedQuestion, previous, decision);
        resolvedQuestion = resolution.resolvedQuestion;
        contextBanner = resolution.contextBanner;
      }
    } catch {
      decision = fallbackDecision();
      const result = await this.assistant.answerQuestion(
        normalizedQuestion,
        requestId,
        auditMetadata(decision),
      );
      return { ...result, contextDecision: decision };
    }

    const result = await this.assistant.answerQuestion(
      resolvedQuestion,
      requestId,
      auditMetadata(decision),
    );
    if (
      result.status === "answered" ||
      result.status === "model_error" ||
      result.status === "validation_error"
    ) {
      this.store.set(
        snapshotFrom(
          sessionKeyHash,
          requestId,
          normalizedQuestion,
          resolvedQuestion,
          result,
          this.now(),
        ),
      );
    }

    const message =
      decision.followUp && contextBanner && result.status === "answered"
        ? `${contextBanner}\n\n${result.message}`
        : result.message;
    return { ...result, message, contextDecision: decision };
  }
}
