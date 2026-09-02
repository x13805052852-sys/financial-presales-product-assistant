import type { ContextSnapshot } from "./types.js";

interface ContextStoreOptions {
  ttlMs?: number;
  maximumEntries?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 30 * 60 * 1_000;
const DEFAULT_MAXIMUM_ENTRIES = 1_000;

export class OneTurnContextStore {
  private readonly entries = new Map<string, ContextSnapshot>();
  private readonly ttlMs: number;
  private readonly maximumEntries: number;
  private readonly now: () => number;

  constructor(options: ContextStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maximumEntries = options.maximumEntries ?? DEFAULT_MAXIMUM_ENTRIES;
    this.now = options.now ?? Date.now;

    if (this.ttlMs <= 0) {
      throw new Error("ttlMs must be greater than zero");
    }
    if (!Number.isInteger(this.maximumEntries) || this.maximumEntries <= 0) {
      throw new Error("maximumEntries must be a positive integer");
    }
  }

  get size(): number {
    return this.entries.size;
  }

  get(sessionKeyHash: string): ContextSnapshot | undefined {
    const entry = this.entries.get(sessionKeyHash);
    if (!entry) {
      return undefined;
    }

    if (this.now() - entry.createdAt >= this.ttlMs) {
      this.entries.delete(sessionKeyHash);
      return undefined;
    }
    return entry;
  }

  set(snapshot: ContextSnapshot): void {
    this.entries.delete(snapshot.sessionKeyHash);
    this.entries.set(snapshot.sessionKeyHash, snapshot);

    while (this.entries.size > this.maximumEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        break;
      }
      this.entries.delete(oldestKey);
    }
  }

  delete(sessionKeyHash: string): void {
    this.entries.delete(sessionKeyHash);
  }
}
