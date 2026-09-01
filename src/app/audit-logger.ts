import { createHash, randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface AuditEvent {
  requestId: string;
  timestamp: string;
  status: string;
  questionFingerprint: string;
  questionPreview: string;
  knowledgeIds: string[];
  model: string;
  elapsedMs: number;
  errorCode?: string;
}

export interface AuditLogger {
  write(event: AuditEvent): Promise<void>;
}

export class NoopAuditLogger implements AuditLogger {
  async write(_event: AuditEvent): Promise<void> {}
}

function redact(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[EMAIL]")
    .replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, "[PHONE]")
    .replace(/\b(?:AQ\.|sk-)[A-Za-z0-9._-]+/g, "[API_KEY]")
    .replace(/\b\d{15,18}[0-9Xx]\b/g, "[IDENTIFIER]")
    .slice(0, 200);
}

export function questionFingerprint(question: string): string {
  return createHash("sha256").update(question).digest("hex").slice(0, 16);
}

export function createRequestId(): string {
  return randomUUID();
}

export function createAuditEvent(
  event: Omit<AuditEvent, "timestamp" | "questionFingerprint" | "questionPreview"> & {
    question: string;
  },
): AuditEvent {
  const { question, ...rest } = event;
  return {
    ...rest,
    timestamp: new Date().toISOString(),
    questionFingerprint: questionFingerprint(question),
    questionPreview: redact(question),
  };
}

export class JsonlAuditLogger implements AuditLogger {
  constructor(private readonly logDirectory: string) {}

  async write(event: AuditEvent): Promise<void> {
    await mkdir(this.logDirectory, { recursive: true });
    const date = event.timestamp.slice(0, 10);
    await appendFile(join(this.logDirectory, `assistant-${date}.jsonl`), `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
