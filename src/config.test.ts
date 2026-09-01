import assert from "node:assert/strict";
import test from "node:test";

import {
  loadKnowledgeMode,
  loadLlmConfig,
  loadRuntimeConfig,
  loadWecomConfig,
} from "./config.js";

const validEnvironment = {
  LLM_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  LLM_API_KEY: "test-key-that-is-never-logged",
  LLM_MODEL: "gemini-3.6-flash",
  WECOM_BOT_ID: "test-bot-id",
  WECOM_BOT_SECRET: "test-bot-secret",
};

test("loads runtime configuration with safe defaults", () => {
  const config = loadRuntimeConfig(validEnvironment);

  assert.equal(config.llm.model, "gemini-3.6-flash");
  assert.equal(config.llm.timeoutMs, 30_000);
  assert.equal(config.llm.maxRetries, 2);
  assert.equal(config.logDir, "logs");
  assert.equal(config.knowledgeMode, "experimental");
  assert.equal(config.wecom.botId, "test-bot-id");
});

test("only accepts explicit knowledge modes", () => {
  assert.equal(loadKnowledgeMode({ KNOWLEDGE_MODE: "production" }), "production");
  assert.throws(() => loadKnowledgeMode({ KNOWLEDGE_MODE: "unsafe" }), /KNOWLEDGE_MODE/);
});

test("supports independent model and WeCom configuration", () => {
  assert.equal(loadLlmConfig(validEnvironment).apiKey, validEnvironment.LLM_API_KEY);
  assert.equal(loadWecomConfig(validEnvironment).botSecret, validEnvironment.WECOM_BOT_SECRET);
});

test("reports the missing variable without exposing other secret values", () => {
  const environment = { ...validEnvironment, LLM_MODEL: "" };

  assert.throws(
    () => loadLlmConfig(environment),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /LLM_MODEL/);
      assert.doesNotMatch(error.message, /test-key-that-is-never-logged/);
      return true;
    },
  );
});

test("rejects invalid URLs and numeric limits", () => {
  assert.throws(
    () => loadLlmConfig({ ...validEnvironment, LLM_BASE_URL: "file:///tmp/model" }),
    /HTTP or HTTPS/,
  );
  assert.throws(
    () => loadLlmConfig({ ...validEnvironment, LLM_TIMEOUT_MS: "999" }),
    /greater than or equal to 1000/,
  );
  assert.throws(
    () => loadLlmConfig({ ...validEnvironment, LLM_MAX_RETRIES: "1.5" }),
    /integer/,
  );
});
