import { generateReqId } from "@wecom/aibot-node-sdk";
import type {
  EventMessage,
  TextMessage,
  WsFrame,
  WsFrameHeaders,
} from "@wecom/aibot-node-sdk";

import type { PresalesAssistant } from "../app/presales-assistant.js";

export interface WecomReplyClient {
  replyStream(
    frame: WsFrameHeaders,
    streamId: string,
    content: string,
    finish?: boolean,
  ): Promise<unknown>;
  replyWelcome(
    frame: WsFrameHeaders,
    body: { msgtype: "text"; text: { content: string } },
  ): Promise<unknown>;
}

export interface MessageHandlerLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

const defaultLogger: MessageHandlerLogger = {
  info: (message) => console.info(message),
  warn: (message) => console.warn(message),
  error: (message) => console.error(message),
};

export function normalizeIncomingText(content: string): string {
  return content
    .replace(/^\s*<@[^>]+>\s*/u, "")
    .replace(/^\s*@\S+\s*/u, "")
    .trim();
}

export function fitWecomContent(content: string, maximumBytes = 20_480): string {
  if (Buffer.byteLength(content, "utf8") <= maximumBytes) {
    return content;
  }

  const suffix = "\n\n[回答过长，已截断]";
  let low = 0;
  let high = content.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = content.slice(0, middle) + suffix;
    if (Buffer.byteLength(candidate, "utf8") <= maximumBytes) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return content.slice(0, low) + suffix;
}

export class WecomMessageHandler {
  private readonly processedMessageIds = new Set<string>();
  private readonly processedOrder: string[] = [];

  constructor(
    private readonly assistant: PresalesAssistant,
    private readonly client: WecomReplyClient,
    private readonly logger: MessageHandlerLogger = defaultLogger,
    private readonly deduplicationLimit = 1_000,
  ) {}

  async handleText(frame: WsFrame<TextMessage>): Promise<void> {
    const messageId = frame.body?.msgid;
    if (!messageId || this.isDuplicate(messageId)) {
      return;
    }

    const streamId = generateReqId("presales");
    const question = normalizeIncomingText(frame.body?.text.content ?? "");
    try {
      await this.client.replyStream(frame, streamId, "正在查询产品资料，请稍候……", false);
    } catch {
      this.logger.warn(`Unable to send processing state for message ${messageId}`);
    }

    try {
      const result = await this.assistant.answerQuestion(question, messageId);
      await this.client.replyStream(frame, streamId, fitWecomContent(result.message), true);
      this.logger.info(`Answered WeCom message ${messageId} with status ${result.status}`);
    } catch {
      this.logger.error(`Unhandled failure while processing WeCom message ${messageId}`);
      await this.client.replyStream(frame, streamId, "服务暂时不可用，请稍后重试。", true).catch(() => undefined);
    }
  }

  async handleUnsupported(frame: WsFrame): Promise<void> {
    const messageId = frame.body?.msgid as string | undefined;
    if (!messageId || this.isDuplicate(messageId)) {
      return;
    }
    const streamId = generateReqId("unsupported");
    await this.client
      .replyStream(frame, streamId, "首版只支持文字提问，请将需求转换为文字后重新发送。", true)
      .catch(() => undefined);
  }

  async handleEnterChat(frame: WsFrame<EventMessage>): Promise<void> {
    await this.client.replyWelcome(frame, {
      msgtype: "text",
      text: {
        content: "你好，我是金融售前产品助手。请描述客户需要的功能、现有系统或目标场景。",
      },
    });
  }

  private isDuplicate(messageId: string): boolean {
    if (this.processedMessageIds.has(messageId)) {
      this.logger.info(`Ignored duplicate WeCom message ${messageId}`);
      return true;
    }

    this.processedMessageIds.add(messageId);
    this.processedOrder.push(messageId);
    if (this.processedOrder.length > this.deduplicationLimit) {
      const oldest = this.processedOrder.shift();
      if (oldest) {
        this.processedMessageIds.delete(oldest);
      }
    }
    return false;
  }
}
