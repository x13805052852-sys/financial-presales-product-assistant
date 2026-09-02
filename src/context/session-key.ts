import { createHash } from "node:crypto";

import type { ConversationIdentity } from "./types.js";

function required(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required`);
  }
  return normalized;
}

export function createSessionKey(identity: ConversationIdentity): string {
  const userId = required(identity.userId, "userId");
  const source =
    identity.chatType === "group"
      ? `group|${required(identity.chatId, "chatId")}|${userId}`
      : `single|${userId}`;

  return createHash("sha256").update(source).digest("hex");
}
