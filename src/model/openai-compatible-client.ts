import type { LlmConfig } from "../config.js";
import type { ChatCompletionRequest, ChatModel } from "./types.js";

interface ClientDependencies {
  fetchImplementation?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

interface ApiErrorBody {
  error?: {
    message?: string;
  };
}

const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);

export class ModelRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ModelRequestError";
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function endpoint(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("chat/completions", normalizedBaseUrl).toString();
}

function errorBody(value: unknown): ApiErrorBody | undefined {
  if (Array.isArray(value)) {
    return errorBody(value[0]);
  }
  if (typeof value === "object" && value !== null) {
    return value as ApiErrorBody;
  }
  return undefined;
}

function completionContent(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) {
    return undefined;
  }
  const firstChoice = choices[0];
  if (typeof firstChoice !== "object" || firstChoice === null) {
    return undefined;
  }
  const message = (firstChoice as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    return undefined;
  }
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" && content.trim() ? content.trim() : undefined;
}

export class OpenAiCompatibleClient implements ChatModel {
  private readonly fetchImplementation: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    private readonly config: LlmConfig,
    dependencies: ClientDependencies = {},
  ) {
    this.fetchImplementation = dependencies.fetchImplementation ?? fetch;
    this.sleep = dependencies.sleep ?? defaultSleep;
  }

  async complete(request: ChatCompletionRequest): Promise<string> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        return await this.requestOnce(request);
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof ModelRequestError
            ? error.status === undefined || retryableStatuses.has(error.status)
            : true;
        if (!retryable || attempt === this.config.maxRetries) {
          break;
        }
        await this.sleep(250 * 2 ** attempt);
      }
    }

    if (lastError instanceof ModelRequestError) {
      throw lastError;
    }
    throw new ModelRequestError("Model request failed before a valid response was received");
  }

  private async requestOnce(request: ChatCompletionRequest): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImplementation(endpoint(this.config.baseUrl), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.1,
        }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => undefined);

      if (!response.ok) {
        const message = errorBody(payload)?.error?.message?.slice(0, 500);
        throw new ModelRequestError(
          message ? `Model service returned ${response.status}: ${message}` : `Model service returned ${response.status}`,
          response.status,
        );
      }

      const content = completionContent(payload);
      if (!content) {
        throw new ModelRequestError("Model service returned an empty or invalid completion", response.status);
      }
      return content;
    } catch (error) {
      if (error instanceof ModelRequestError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new ModelRequestError("Model request timed out");
      }
      throw new ModelRequestError("Model request failed");
    } finally {
      clearTimeout(timeout);
    }
  }
}
