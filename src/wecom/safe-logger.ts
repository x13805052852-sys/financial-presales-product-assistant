import type { Logger } from "@wecom/aibot-node-sdk";

function safeArguments(args: unknown[]): string {
  return args
    .map((value) => (value instanceof Error ? value.message : String(value)))
    .join(" ")
    .replace(/\b(?:AQ\.|sk-)[A-Za-z0-9._-]+/g, "[REDACTED]")
    .replace(/secret[=:]\s*\S+/giu, "secret=[REDACTED]");
}

export class SafeWecomLogger implements Logger {
  debug(_message: string, ..._args: unknown[]): void {}

  info(message: string, ...args: unknown[]): void {
    console.info(`[WeCom] ${message} ${safeArguments(args)}`.trim());
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WeCom] ${message} ${safeArguments(args)}`.trim());
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[WeCom] ${message} ${safeArguments(args)}`.trim());
  }
}
