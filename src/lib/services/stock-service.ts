import { CANONICAL_QUOTE_PROVIDER } from '../providers/config';
import { StockProviderFactory } from '../providers/factory';
import { APIError, KLineSeries, StockQuote } from '../types/stock-api';

export class StockService {
  async getMultipleQuotes(
    symbols: string[],
    providerName: string = CANONICAL_QUOTE_PROVIDER
  ): Promise<StockQuote[]> {
    const quotes: StockQuote[] = [];
    const errors: Array<{ symbol: string; error: APIError }> = [];

    const results = await Promise.allSettled(
      symbols.map((symbol) => this.getQuote(symbol, providerName))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        quotes.push(result.value);
        return;
      }

      const reason = result.reason;
      const apiError: APIError =
        reason && typeof reason === 'object' && 'code' in reason
          ? (reason as APIError)
          : {
              code: 'UNKNOWN_ERROR',
              message: reason?.message || 'Unknown error'
            };

      errors.push({
        symbol: symbols[index],
        error: apiError
      });
    });

    if (errors.length > 0 && quotes.length === 0) {
      throw {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch any stock quotes',
        details: { errors }
      } as APIError;
    }

    return quotes;
  }

  async getQuote(
    symbol: string,
    provider: string = CANONICAL_QUOTE_PROVIDER
  ): Promise<StockQuote> {
    try {
      const stockProvider = StockProviderFactory.getProvider(provider);
      return await stockProvider.getQuote(symbol);
    } catch (error) {
      if (this.isAPIError(error)) {
        throw error;
      }

      throw {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote',
        details: { originalError: error }
      } as APIError;
    }
  }

  async getKLineSeries(
    symbol: string,
    provider: string = CANONICAL_QUOTE_PROVIDER
  ): Promise<KLineSeries> {
    try {
      const stockProvider = StockProviderFactory.getProvider(provider);
      return await stockProvider.getKLines(symbol);
    } catch (error) {
      if (this.isAPIError(error)) {
        throw error;
      }

      throw {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch kline series',
        details: { originalError: error }
      } as APIError;
    }
  }

  private isAPIError(error: unknown): error is APIError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    );
  }
}

export function getStockService(): StockService {
  return new StockService();
}
