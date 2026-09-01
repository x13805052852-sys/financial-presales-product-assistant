import { loadKnowledgeMode, loadLlmConfig } from "../config.js";
import { JsonlAuditLogger } from "../app/audit-logger.js";
import { PresalesAssistant } from "../app/presales-assistant.js";
import { loadKnowledgeBase } from "../knowledge/loader.js";
import { OpenAiCompatibleClient } from "../model/openai-compatible-client.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  process.stderr.write('Usage: npm run ask -- "客户需要的功能是什么？"\n');
  process.exitCode = 2;
} else {
  const llmConfig = loadLlmConfig();
  const assistant = new PresalesAssistant({
    knowledgeBase: loadKnowledgeBase(),
    model: new OpenAiCompatibleClient(llmConfig),
    modelName: llmConfig.model,
    knowledgeMode: loadKnowledgeMode(),
    logger: new JsonlAuditLogger(process.env.LOG_DIR?.trim() || "logs"),
  });
  const result = await assistant.answerQuestion(question);
  process.stdout.write(`${result.message}\n`);
}
