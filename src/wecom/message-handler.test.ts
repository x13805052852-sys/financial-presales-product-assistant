import assert from "node:assert/strict";
import test from "node:test";

import { MessageType } from "@wecom/aibot-node-sdk";
import type { TextMessage, WsFrame } from "@wecom/aibot-node-sdk";

import type { AnswerResult } from "../app/presales-assistant.js";
import { fitWecomContent, normalizeIncomingText, WecomMessageHandler } from "./message-handler.js";

class FakeAssistant {
  readonly questions: string[] = [];

  async answerQuestion(question: string, requestId: string): Promise<AnswerResult> {
    this.questions.push(question);
    return {
      requestId,
      status: "answered",
      message: "结论：可以。\n推荐组合：TDH 数据湖版\n产品分工：TDH 负责数据湖。",
      knowledgeIds: ["TDH-M001"],
      sources: ["source#1"],
      elapsedMs: 10,
      experimental: true,
    };
  }
}

class FakeReplyClient {
  readonly streams: Array<{ content: string; finish: boolean }> = [];
  readonly welcomes: string[] = [];

  async replyStream(
    _frame: { headers: { req_id: string } },
    _streamId: string,
    content: string,
    finish = false,
  ): Promise<unknown> {
    this.streams.push({ content, finish });
    return {};
  }

  async replyWelcome(
    _frame: { headers: { req_id: string } },
    body: { msgtype: "text"; text: { content: string } },
  ): Promise<unknown> {
    this.welcomes.push(body.text.content);
    return {};
  }
}

const silentLogger = { info: () => undefined, warn: () => undefined, error: () => undefined };

function textFrame(messageId = "message-1", content = "@金融售前产品助手 客户需要数据湖"): WsFrame<TextMessage> {
  return {
    headers: { req_id: "req-1" },
    body: {
      msgid: messageId,
      aibotid: "bot-1",
      chattype: "group",
      from: { userid: "user-1" },
      msgtype: MessageType.Text,
      text: { content },
    },
  };
}

test("normalizes group mentions and respects the WeCom byte limit", () => {
  assert.equal(normalizeIncomingText("@金融售前产品助手  客户需要数据湖"), "客户需要数据湖");
  const fitted = fitWecomContent("中".repeat(10_000), 100);
  assert.ok(Buffer.byteLength(fitted, "utf8") <= 100);
  assert.match(fitted, /已截断/);
});

test("sends a processing state and then the final answer", async () => {
  const assistant = new FakeAssistant();
  const client = new FakeReplyClient();
  const handler = new WecomMessageHandler(assistant as never, client, silentLogger);

  await handler.handleText(textFrame());

  assert.deepEqual(assistant.questions, ["客户需要数据湖"]);
  assert.equal(client.streams.length, 2);
  assert.equal(client.streams[0]?.finish, false);
  assert.match(client.streams[0]?.content ?? "", /正在查询/);
  assert.equal(client.streams[1]?.finish, true);
  assert.match(client.streams[1]?.content ?? "", /推荐组合/);
});

test("ignores a duplicate message ID", async () => {
  const assistant = new FakeAssistant();
  const client = new FakeReplyClient();
  const handler = new WecomMessageHandler(assistant as never, client, silentLogger);

  await handler.handleText(textFrame("duplicate"));
  await handler.handleText(textFrame("duplicate"));

  assert.equal(assistant.questions.length, 1);
  assert.equal(client.streams.length, 2);
});
