import { loadLlmConfig } from "../config.js";
import { loadKnowledgeBase } from "../knowledge/loader.js";
import { retrieveKnowledge } from "../knowledge/retriever.js";
import { validateAnswer } from "../model/answer-validator.js";
import { OpenAiCompatibleClient } from "../model/openai-compatible-client.js";
import { buildGroundedRequest } from "../model/prompt.js";

const question =
  process.argv.slice(2).join(" ").trim() ||
  "我想要实时流入数据库并且带有数据治理，应当怎么搭配？";
const knowledgeBase = loadKnowledgeBase();
const retrieval = retrieveKnowledge(question, knowledgeBase);

if (retrieval.hits.length === 0) {
  throw new Error("No knowledge evidence was retrieved for the smoke-test question");
}

const client = new OpenAiCompatibleClient(loadLlmConfig());
const answer = await client.complete(buildGroundedRequest(question, retrieval.hits));
const validation = validateAnswer(answer, retrieval.hits);

process.stdout.write(`${answer}\n`);
if (!validation.valid) {
  process.stderr.write(`Answer validation failed: ${validation.errors.join("; ")}\n`);
  process.exitCode = 1;
}
