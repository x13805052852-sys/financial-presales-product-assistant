export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface WecomConfig {
  botId: string;
  botSecret: string;
}

export interface RuntimeConfig {
  llm: LlmConfig;
  wecom: WecomConfig;
  logDir: string;
}

type Environment = NodeJS.ProcessEnv | Record<string, string | undefined>;

function requireValue(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseInteger(
  env: Environment,
  name: string,
  fallback: number,
  minimum: number,
): number {
  const raw = env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}`);
  }
  return parsed;
}

function parseBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("LLM_BASE_URL must be a valid HTTP or HTTPS URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("LLM_BASE_URL must use HTTP or HTTPS");
  }

  return url.toString();
}

export function loadLlmConfig(env: Environment = process.env): LlmConfig {
  return {
    baseUrl: parseBaseUrl(requireValue(env, "LLM_BASE_URL")),
    apiKey: requireValue(env, "LLM_API_KEY"),
    model: requireValue(env, "LLM_MODEL"),
    timeoutMs: parseInteger(env, "LLM_TIMEOUT_MS", 30_000, 1_000),
    maxRetries: parseInteger(env, "LLM_MAX_RETRIES", 2, 0),
  };
}

export function loadWecomConfig(env: Environment = process.env): WecomConfig {
  return {
    botId: requireValue(env, "WECOM_BOT_ID"),
    botSecret: requireValue(env, "WECOM_BOT_SECRET"),
  };
}

export function loadRuntimeConfig(env: Environment = process.env): RuntimeConfig {
  return {
    llm: loadLlmConfig(env),
    wecom: loadWecomConfig(env),
    logDir: env.LOG_DIR?.trim() || "logs",
  };
}
