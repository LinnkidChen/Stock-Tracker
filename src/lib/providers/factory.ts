import {
  ProviderHealthReport,
  ProviderMetadata,
  StockDataProvider
} from './types';
import { APIError } from '../types/stock-api';
import { AUTO_QUOTE_PROVIDER } from './config';
import { FallbackStockDataProvider } from './fallback-provider';
import {
  createRegisteredProvider,
  getFallbackOrder,
  listProviderMetadata,
  resolveProviderOrThrow
} from './registry';

export class StockProviderFactory {
  static getProvider(name?: string | null): StockDataProvider {
    const provider = resolveProviderOrThrow(name);

    if (provider === AUTO_QUOTE_PROVIDER) {
      return new FallbackStockDataProvider();
    }

    return createRegisteredProvider(provider);
  }

  static listProviders(): ProviderMetadata[] {
    return listProviderMetadata();
  }

  static getFallbackOrder() {
    return getFallbackOrder();
  }

  static async getProviderHealthReport(): Promise<ProviderHealthReport> {
    const checkedAt = new Date().toISOString();
    const checks = await Promise.all(
      getFallbackOrder().map(async (providerId) => {
        try {
          return await createRegisteredProvider(providerId).healthCheck();
        } catch (error) {
          const apiError = isAPIError(error)
            ? error
            : ({
                code: 'UNKNOWN_ERROR',
                message:
                  error instanceof Error
                    ? error.message
                    : 'Provider health check failed'
              } as APIError);

          return {
            provider: providerId,
            providerId,
            status: 'degraded' as const,
            latencyMs: 0,
            checkedAt,
            details: {
              code: apiError.code,
              message: apiError.message
            }
          };
        }
      })
    );
    const status = checks.some((check) => check.status === 'healthy')
      ? 'healthy'
      : checks.some((check) => check.status === 'degraded')
        ? 'degraded'
        : 'unconfigured';

    return {
      provider: 'Auto',
      providerId: AUTO_QUOTE_PROVIDER,
      status,
      checkedAt,
      fallbackOrder: getFallbackOrder(),
      providers: checks,
      metadata: listProviderMetadata()
    };
  }
}

function isAPIError(error: unknown): error is APIError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error
  );
}
