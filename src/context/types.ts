export type ConversationChatType = "single" | "group";

export interface ConversationIdentity {
  chatType: ConversationChatType;
  chatId?: string;
  userId: string;
}

export type ContextSnapshotStatus = "answered" | "retryable_error";

export interface ContextSnapshot {
  sessionKeyHash: string;
  messageId: string;
  question: string;
  resolvedQuestion: string;
  intent: string;
  products: string[];
  capabilities: string[];
  recommendations: string[];
  knowledgeIds: string[];
  answerSummary: string;
  status: ContextSnapshotStatus;
  createdAt: number;
}

export type ContextDecisionReason =
  | "follow_up"
  | "new_question"
  | "no_previous_turn"
  | "expired"
  | "identity_mismatch"
  | "unsafe"
  | "resolver_error";

export interface ContextDecision {
  followUp: boolean;
  score: number;
  matchedRules: string[];
  reason: ContextDecisionReason;
}

export interface ConversationMessageContext {
  identity: ConversationIdentity;
  quoteText?: string;
}

export interface GroundingSummary {
  normalizedQuestion: string;
  topicLabel: string;
  products: string[];
  capabilities: string[];
  recommendations: string[];
  knowledgeIds: string[];
}
