import {
  type APIErrorCode,
  type KLineInterval,
  KLineSeries,
  StockQuote
} from '../types/stock-api';

export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unconfigured';

export interface ProviderHealthCheck {
  provider: string;
  status: ProviderHealthStatus;
  latencyMs: number;
  checkedAt: string;
  details?: {
    code?: APIErrorCode;
    message?: string;
    retryAfter?: number;
    [key: string]: unknown;
  };
}

export interface StockDataProvider {
  name: string;
  getQuote(symbol: string): Promise<StockQuote>;
  getKLines(symbol: string, interval?: KLineInterval): Promise<KLineSeries>;
  healthCheck(): Promise<ProviderHealthCheck>;
}
