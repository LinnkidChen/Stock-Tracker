export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface BatchFetchMetrics {
  totalDuration: number;
  symbolCount: number;
  successCount: number;
  errorCount: number;
  averagePerSymbol: number;
  slowSymbols: string[];
}

const SLOW_REQUEST_THRESHOLD = 3000; // 3 seconds
const PERFORMANCE_STORAGE_KEY = 'stock-dashboard-performance';
const MAX_STORED_METRICS = 100;

/**
 * Tracks performance metrics for debugging and optimization
 */
class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private activeTimers: Map<string, number> = new Map();

  /**
   * Starts timing a performance measurement
   */
  startTiming(name: string, metadata?: Record<string, unknown>): void {
    const startTime = performance.now();
    this.activeTimers.set(name, startTime);

    if (metadata) {
      this.activeTimers.set(`${name}_metadata`, metadata as any);
    }
  }

  /**
   * Ends timing and records the measurement
   */
  endTiming(name: string): number | null {
    const endTime = performance.now();
    const startTime = this.activeTimers.get(name);

    if (startTime === undefined) {
      // eslint-disable-next-line no-console
      console.warn(`Performance timer '${name}' was not started`);
      return null;
    }

    const duration = endTime - startTime;
    const metadata = this.activeTimers.get(
      `${name}_metadata`
    ) as unknown as Record<string, unknown>;

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata
    };

    this.addMetric(metric);
    this.activeTimers.delete(name);
    this.activeTimers.delete(`${name}_metadata`);

    // Warn about slow requests
    if (duration > SLOW_REQUEST_THRESHOLD) {
      // eslint-disable-next-line no-console
      console.warn(
        `Slow performance detected: ${name} took ${duration.toFixed(2)}ms`,
        metadata
      );
    }

    return duration;
  }

  /**
   * Records a metric directly
   */
  addMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > MAX_STORED_METRICS) {
      this.metrics = this.metrics.slice(-MAX_STORED_METRICS);
    }

    // Store in localStorage for debugging
    try {
      localStorage.setItem(
        PERFORMANCE_STORAGE_KEY,
        JSON.stringify(this.metrics)
      );
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Gets all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Gets metrics filtered by name pattern
   */
  getMetricsByPattern(pattern: RegExp): PerformanceMetric[] {
    return this.metrics.filter((m) => pattern.test(m.name));
  }

  /**
   * Clears all stored metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    try {
      localStorage.removeItem(PERFORMANCE_STORAGE_KEY);
    } catch (e) {
      // Ignore storage errors
    }
  }

  /**
   * Gets performance summary for batch fetch operations
   */
  getBatchFetchSummary(): BatchFetchMetrics | null {
    const batchMetrics = this.getMetricsByPattern(/^batch-fetch/);

    if (batchMetrics.length === 0) {
      return null;
    }

    const totalDuration = batchMetrics.reduce((sum, m) => sum + m.duration, 0);
    const symbolCounts = batchMetrics.map(
      (m) => (m.metadata?.symbolCount as number) || 0
    );
    const totalSymbols = symbolCounts.reduce((sum, count) => sum + count, 0);

    let successCount = 0;
    let errorCount = 0;
    const slowSymbols: string[] = [];

    batchMetrics.forEach((metric) => {
      const metadata = metric.metadata;
      if (metadata?.successCount)
        successCount += metadata.successCount as number;
      if (metadata?.errorCount) errorCount += metadata.errorCount as number;
      if (metric.duration > SLOW_REQUEST_THRESHOLD && metadata?.symbols) {
        slowSymbols.push(...Array.from(metadata.symbols as string[]));
      }
    });

    return {
      totalDuration,
      symbolCount: totalSymbols,
      successCount,
      errorCount,
      averagePerSymbol: totalSymbols > 0 ? totalDuration / totalSymbols : 0,
      slowSymbols: Array.from(new Set(slowSymbols))
    };
  }
}

// Global instance
export const performanceTracker = new PerformanceTracker();

/**
 * Decorator for timing async functions
 */
export function withTiming<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    performanceTracker.startTiming(name);
    try {
      const result = await fn(...args);
      performanceTracker.endTiming(name);
      return result;
    } catch (error) {
      performanceTracker.endTiming(name);
      throw error;
    }
  };
}

/**
 * Times a batch fetch operation with detailed metrics
 */
export async function measureBatchFetch<T>(
  symbols: string[],
  fetchFn: () => Promise<T>
): Promise<T> {
  const name = `batch-fetch-${symbols.length}-symbols`;

  performanceTracker.startTiming(name, {
    symbols,
    symbolCount: symbols.length,
    timestamp: Date.now()
  });

  try {
    const result = await fetchFn();
    const duration = performanceTracker.endTiming(name);

    // Log summary for large batches
    if (symbols.length > 5 && duration) {
      // eslint-disable-next-line no-console
      console.log(
        `Batch fetch completed: ${symbols.length} symbols in ${duration.toFixed(2)}ms ` +
          `(${(duration / symbols.length).toFixed(2)}ms per symbol)`
      );
    }

    return result;
  } catch (error) {
    performanceTracker.endTiming(name);
    throw error;
  }
}

/**
 * Gets performance insights for debugging
 */
export function getPerformanceInsights(): {
  recentMetrics: PerformanceMetric[];
  batchSummary: BatchFetchMetrics | null;
  slowOperations: PerformanceMetric[];
} {
  const recentMetrics = performanceTracker.getMetrics().slice(-20);
  const batchSummary = performanceTracker.getBatchFetchSummary();
  const slowOperations = performanceTracker
    .getMetrics()
    .filter((m) => m.duration > SLOW_REQUEST_THRESHOLD)
    .slice(-10);

  return {
    recentMetrics,
    batchSummary,
    slowOperations
  };
}
