import { WSClient } from "@wecom/aibot-node-sdk";

import { JsonlAuditLogger } from "../app/audit-logger.js";
import { PresalesAssistant } from "../app/presales-assistant.js";
import { loadRuntimeConfig } from "../config.js";
import { loadKnowledgeBase } from "../knowledge/loader.js";
import { OpenAiCompatibleClient } from "../model/openai-compatible-client.js";
import { WecomMessageHandler } from "../wecom/message-handler.js";
import { SafeWecomLogger } from "../wecom/safe-logger.js";

const config = loadRuntimeConfig();
const sdkLogger = new SafeWecomLogger();
const client = new WSClient({
  botId: config.wecom.botId,
  secret: config.wecom.botSecret,
  maxReconnectAttempts: -1,
  maxAuthFailureAttempts: 3,
  logger: sdkLogger,
});
const assistant = new PresalesAssistant({
  knowledgeBase: loadKnowledgeBase(),
  model: new OpenAiCompatibleClient(config.llm),
  modelName: config.llm.model,
  knowledgeMode: config.knowledgeMode,
  logger: new JsonlAuditLogger(config.logDir),
});
const handler = new WecomMessageHandler(assistant, client, sdkLogger);

client.on("authenticated", () => {
  sdkLogger.info("机器人认证成功，可以开始接收问题");
});
client.on("reconnecting", (attempt) => {
  sdkLogger.warn(`连接中断，正在进行第 ${attempt} 次重连`);
});
client.on("disconnected", (reason) => {
  sdkLogger.warn(`连接已断开：${reason}`);
});
client.on("error", (error) => {
  sdkLogger.error(`连接错误：${error.message}`);
});
client.on("message.text", (frame) => {
  void handler.handleText(frame);
});
for (const event of ["message.image", "message.mixed", "message.voice", "message.file", "message.video"] as const) {
  client.on(event, (frame) => {
    void handler.handleUnsupported(frame);
  });
}
client.on("event.enter_chat", (frame) => {
  void handler.handleEnterChat(frame);
});

function shutdown(signal: string): void {
  sdkLogger.info(`收到 ${signal}，正在停止机器人`);
  client.disconnect();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

sdkLogger.info("正在连接企业微信智能机器人……");
client.connect();
