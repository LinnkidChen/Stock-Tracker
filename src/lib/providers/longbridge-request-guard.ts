import { APIError } from '../types/stock-api';

type SleepFn = (ms: number) => Promise<void>;

export interface LongbridgeRequestGuardOptions {
  maxConcurrent?: number;
  maxStartsPerWindow?: number;
  windowMs?: number;
  queueLimit?: number;
  queueTimeoutMs?: number;
  concurrencyPollMs?: number;
  now?: () => number;
  sleep?: SleepFn;
}

const DEFAULT_OPTIONS = {
  maxConcurrent: 5,
  maxStartsPerWindow: 10,
  windowMs: 1000,
  queueLimit: 50,
  queueTimeoutMs: 2000,
  concurrencyPollMs: 10
};

export class LongbridgeRequestGuard {
  private activeCount = 0;
  private waitingCount = 0;
  private starts: number[] = [];
  private readonly maxConcurrent: number;
  private readonly maxStartsPerWindow: number;
  private readonly windowMs: number;
  private readonly queueLimit: number;
  private readonly queueTimeoutMs: number;
  private readonly concurrencyPollMs: number;
  private readonly now: () => number;
  private readonly sleep: SleepFn;

  constructor(options: LongbridgeRequestGuardOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? DEFAULT_OPTIONS.maxConcurrent;
    this.maxStartsPerWindow =
      options.maxStartsPerWindow ?? DEFAULT_OPTIONS.maxStartsPerWindow;
    this.windowMs = options.windowMs ?? DEFAULT_OPTIONS.windowMs;
    this.queueLimit = options.queueLimit ?? DEFAULT_OPTIONS.queueLimit;
    this.queueTimeoutMs =
      options.queueTimeoutMs ?? DEFAULT_OPTIONS.queueTimeoutMs;
    this.concurrencyPollMs =
      options.concurrencyPollMs ?? DEFAULT_OPTIONS.concurrencyPollMs;
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ??
      ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await operation();
    } finally {
      this.activeCount -= 1;
    }
  }

  private async acquire(): Promise<void> {
    if (this.waitingCount >= this.queueLimit) {
      throw createRequestGuardLimitError(
        Math.ceil(this.queueTimeoutMs / 1000),
        'queue-full'
      );
    }

    this.waitingCount += 1;
    const deadline = this.now() + this.queueTimeoutMs;

    try {
      while (true) {
        const now = this.now();
        const waitMs = this.getWaitMs(now);

        if (waitMs === 0) {
          this.activeCount += 1;
          this.starts.push(now);
          return;
        }

        if (now + waitMs > deadline) {
          throw createRequestGuardLimitError(
            Math.max(1, Math.ceil((deadline - now) / 1000)),
            'queue-timeout'
          );
        }

        await this.sleep(waitMs);
      }
    } finally {
      this.waitingCount -= 1;
    }
  }

  private getWaitMs(now: number): number {
    this.starts = this.starts.filter(
      (startedAt) => now - startedAt < this.windowMs
    );

    if (this.activeCount >= this.maxConcurrent) {
      return this.concurrencyPollMs;
    }

    if (this.starts.length >= this.maxStartsPerWindow) {
      return Math.max(1, this.windowMs - (now - this.starts[0]));
    }

    return 0;
  }
}

export const longbridgeRequestGuard = new LongbridgeRequestGuard();

function createRequestGuardLimitError(
  retryAfter: number,
  reason: 'queue-full' | 'queue-timeout'
): APIError {
  return {
    code: 'API_LIMIT_EXCEEDED',
    message:
      'Longbridge request rate limit exceeded. Please try again shortly.',
    details: {
      retryAfter,
      source: 'longbridge-request-guard',
      reason
    }
  };
}
