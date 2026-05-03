import {
  type APIErrorCode,
  type KLineInterval,
  KLineSeries,
  StockQuote
} from '../types/stock-api';

export type ConcreteProviderId = 'longbridge' | 'yahoo';
export type ProviderId = 'auto' | ConcreteProviderId;
export type ProviderOperation = 'quote' | 'kline';
export type ProviderHealthStatus = 'healthy' | 'degraded' | 'unconfigured';

export interface ProviderCapabilities {
  quotes: boolean;
  kLines: boolean;
  realtime: 'polling' | 'streaming' | 'none';
  intervals: KLineInterval[];
  markets: string[];
  requiresCredentials: boolean;
}

export interface ProviderMetadata {
  id: ConcreteProviderId;
  name: string;
  label: string;
  fallbackRank: number;
  capabilities: ProviderCapabilities;
}

export interface ProviderHealthCheck {
  provider: string;
  providerId?: ProviderId;
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

export interface ProviderRoutingPlan {
  requestedProvider: ProviderId;
  operation: ProviderOperation;
  symbol: string;
  market: string;
  providers: ConcreteProviderId[];
  reason: string;
}

export interface ProviderFallbackAttempt {
  providerId: ConcreteProviderId;
  provider: string;
  code?: APIErrorCode;
  message: string;
}

export interface ProviderHealthReport {
  provider: 'Auto';
  providerId: 'auto';
  status: ProviderHealthStatus;
  checkedAt: string;
  fallbackOrder: ConcreteProviderId[];
  providers: ProviderHealthCheck[];
  metadata: ProviderMetadata[];
}

export interface StockDataProvider {
  id: ProviderId;
  name: string;
  capabilities: ProviderCapabilities;
  getQuote(symbol: string): Promise<StockQuote>;
  getKLines(symbol: string, interval?: KLineInterval): Promise<KLineSeries>;
  healthCheck(): Promise<ProviderHealthCheck>;
}
