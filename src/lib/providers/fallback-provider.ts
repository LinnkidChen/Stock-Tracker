import { logger } from '../logger';
import {
  APIError,
  DEFAULT_KLINE_INTERVAL,
  type KLineInterval,
  KLineSeries,
  StockQuote
} from '../types/stock-api';
import { AUTO_QUOTE_PROVIDER } from './config';
import {
  createRegisteredProvider,
  getFallbackOrder,
  getProviderRoutingPlan,
  listProviderMetadata
} from './registry';
import {
  ConcreteProviderId,
  ProviderCapabilities,
  ProviderFallbackAttempt,
  ProviderHealthCheck,
  StockDataProvider
} from './types';

const AUTO_PROVIDER_CAPABILITIES: ProviderCapabilities = {
  quotes: true,
  kLines: true,
  realtime: 'polling',
  intervals: ['day', 'week', 'month', 'year'],
  markets: Array.from(
    new Set(
      listProviderMetadata().flatMap(
        (provider) => provider.capabilities.markets
      )
    )
  ),
  requiresCredentials: false
};

export class FallbackStockDataProvider implements StockDataProvider {
  id = AUTO_QUOTE_PROVIDER;
  name = 'Auto';
  capabilities = AUTO_PROVIDER_CAPABILITIES;

  async getQuote(symbol: string): Promise<StockQuote> {
    const plan = getProviderRoutingPlan({
      provider: AUTO_QUOTE_PROVIDER,
      symbol,
      operation: 'quote'
    });

    return this.executeWithFallback(
      plan.providers,
      (provider) => provider.getQuote(symbol),
      {
        symbol: plan.symbol,
        operation: 'quote',
        market: plan.market,
        reason: plan.reason
      }
    );
  }

  async getKLines(
    symbol: string,
    interval: KLineInterval = DEFAULT_KLINE_INTERVAL
  ): Promise<KLineSeries> {
    const plan = getProviderRoutingPlan({
      provider: AUTO_QUOTE_PROVIDER,
      symbol,
      operation: 'kline',
      interval
    });

    return this.executeWithFallback(
      plan.providers,
      (provider) => provider.getKLines(symbol, interval),
      {
        symbol: plan.symbol,
        operation: 'kline',
        market: plan.market,
        reason: plan.reason,
        interval
      }
    );
  }

  async healthCheck(): Promise<ProviderHealthCheck> {
    const startedAt = Date.now();
    const checkedAt = new Date(startedAt).toISOString();
    const checks = await Promise.all(
      getFallbackOrder().map(async (providerId) => {
        try {
          return await createRegisteredProvider(providerId).healthCheck();
        } catch (error) {
          const apiError = this.toAPIError(error);
          return {
            provider: providerId,
            providerId,
            status: 'degraded',
            latencyMs: 0,
            checkedAt,
            details: {
              code: apiError.code,
              message: apiError.message
            }
          } as ProviderHealthCheck;
        }
      })
    );
    const status = checks.some((check) => check.status === 'healthy')
      ? 'healthy'
      : checks.some((check) => check.status === 'degraded')
        ? 'degraded'
        : 'unconfigured';

    return {
      provider: this.name,
      providerId: this.id,
      status,
      latencyMs: Math.max(0, Date.now() - startedAt),
      checkedAt,
      details: {
        fallbackOrder: getFallbackOrder(),
        providers: checks.map((check) => ({
          providerId: check.providerId,
          provider: check.provider,
          status: check.status
        }))
      }
    };
  }

  private async executeWithFallback<T>(
    providerIds: ConcreteProviderId[],
    operation: (provider: StockDataProvider) => Promise<T>,
    context: {
      symbol: string;
      operation: 'quote' | 'kline';
      market: string;
      reason: string;
      interval?: KLineInterval;
    }
  ): Promise<T> {
    const attempts: ProviderFallbackAttempt[] = [];
    let selectedError: APIError | null = null;

    for (let index = 0; index < providerIds.length; index += 1) {
      const providerId = providerIds[index];
      const provider = createRegisteredProvider(providerId);

      try {
        return await operation(provider);
      } catch (error) {
        const apiError = this.toAPIError(error);
        selectedError = chooseFallbackError(selectedError, apiError);
        attempts.push({
          providerId,
          provider: provider.name,
          code: apiError.code,
          message: apiError.message
        });

        if (index < providerIds.length - 1) {
          logger.info('Market data provider failed; trying fallback', {
            providerId,
            symbol: context.symbol,
            operation: context.operation,
            code: apiError.code,
            message: apiError.message
          });
        }
      }
    }

    const error = selectedError ?? {
      code: 'UNKNOWN_ERROR',
      message: 'Market data provider failed'
    };

    throw {
      code: error.code,
      message: `All market data providers failed for ${context.symbol}: ${error.message}`,
      details: {
        ...error.details,
        providerFallback: {
          requestedProvider: AUTO_QUOTE_PROVIDER,
          symbol: context.symbol,
          operation: context.operation,
          market: context.market,
          interval: context.interval,
          route: providerIds,
          reason: context.reason,
          attempts
        }
      }
    } as APIError;
  }

  private toAPIError(error: unknown): APIError {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    ) {
      return error as APIError;
    }

    return {
      code: 'UNKNOWN_ERROR',
      message:
        error instanceof Error ? error.message : 'Market data provider failed'
    };
  }
}

function chooseFallbackError(
  current: APIError | null,
  next: APIError
): APIError {
  if (!current) {
    return next;
  }

  if (current.code === 'INVALID_API_KEY' && next.code !== 'INVALID_API_KEY') {
    return next;
  }

  if (next.code === 'API_LIMIT_EXCEEDED') {
    return next;
  }

  if (current.code === 'UNKNOWN_ERROR' && next.code !== 'UNKNOWN_ERROR') {
    return next;
  }

  return current;
}
