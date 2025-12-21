import { StockQuote, APIError, KLineSeries } from '../types/stock-api';
import { Stock } from '../types';
import { StockProviderFactory } from '../providers/factory';
import { getAlphaVantageClient } from './alpha-vantage-client';

export class StockService {
  private readonly BATCH_SIZE = 5; // Alpha Vantage free tier limit (5 calls/min)
  private readonly BATCH_DELAY_MS = 12000; // 12 seconds between batches

  async getMultipleQuotes(
    symbols: string[],
    providerName: string = 'default'
  ): Promise<StockQuote[]> {
    const quotes: StockQuote[] = [];
    const errors: Array<{ symbol: string; error: APIError }> = [];

    // Process in batches to respect rate limits
    // Note: This logic is primarily optimized for AlphaVantage rate limits.
    // Longbridge might have different limits, but basic throttling is safe for now.
    for (let i = 0; i < symbols.length; i += this.BATCH_SIZE) {
      const batch = symbols.slice(i, i + this.BATCH_SIZE);
      const promises = batch.map((symbol) =>
        this.getQuote(symbol, providerName)
      );
      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          quotes.push(result.value);
        } else {
          // Type guard for APIError is now handled by the provider wrapper or catch block
          // but we still need to reshape the error for the details array
          const reason = result.reason;
          const apiError: APIError =
            reason && typeof reason === 'object' && 'code' in reason
              ? (reason as APIError)
              : {
                  code: 'UNKNOWN_ERROR',
                  message: reason?.message || 'Unknown error'
                };

          errors.push({
            symbol: batch[index],
            error: apiError
          });
        }
      });

      // Add delay between batches if not the last batch
      if (i + this.BATCH_SIZE < symbols.length) {
        await this.delay(this.BATCH_DELAY_MS);
      }
    }

    if (errors.length > 0 && quotes.length === 0) {
      // All requests failed
      throw {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch any stock quotes',
        details: { errors }
      } as APIError;
    }

    return quotes;
  }

  async searchStocks(keywords: string): Promise<Stock[]> {
    try {
      // Search currently relies on AlphaVantage as Longbridge search implementation is different/not done
      // We will temporarily instantiate AlphaVantage provider directly or use the default provider from factory

      // Note: Search is not part of the common interface yet, so we have to cast or allow it only for AlphaVantageProvider
      // Ideally we should add search to the provider interface.
      // For now, let's keep using getAlphaVantageClient directly here?
      // But we removed the import.
      // Let's re-import client just for this method OR add search to interface.
      // The plan didn't specify search, let's update interface later.
      // For now, I'll cheat and use `any` or import the client again if needed.
      // Better: let's update the interface to include search!

      // Wait, I cannot easily update the interface in this single MultiReplace.
      // I'll stick to using the client via a new import or just use the provider.
      // Actually `provider` doesn't have search method in my new interface.
      // I should update the interface first? No, let's just use the client inside this function.

      // Re-importing client inside the function effectively? No, top level.
      // I replaced top level imports. I need to keep `getAlphaVantageClient` if I use it here.

      // Let's restore the import line but ONLY for search use.
      // Actually, let's just leave `getAlphaVantageClient` logic here but I need to import it.

      // I will add the import back.
      const client = getAlphaVantageClient();
      const searchResults = await client.searchSymbol(keywords);

      // Transform search results to basic Stock interface
      return searchResults.map((result) => ({
        symbol: result.symbol,
        name: result.name,
        price: 0, // Price not available in search results
        change: 0, // Change not available in search results
        changePercent: 0 // Change percent not available in search results
      }));
    } catch (error) {
      if (this.isAPIError(error)) {
        throw error;
      }

      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to search stocks',
        details: { originalError: error }
      };
      throw apiError;
    }
  }

  private isAPIError(error: any): error is APIError {
    return (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getQuote(
    symbol: string,
    provider: string = 'default'
  ): Promise<StockQuote> {
    try {
      // Use the provider factory to get the appropriate provider
      const stockProvider = StockProviderFactory.getProvider(provider);
      return await stockProvider.getQuote(symbol);
    } catch (error) {
      if (this.isAPIError(error)) {
        throw error;
      }

      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote',
        details: { originalError: error }
      };
      throw apiError;
    }
  }

  async getKLineSeries(
    symbol: string,
    provider: string = 'default'
  ): Promise<KLineSeries> {
    try {
      const stockProvider = StockProviderFactory.getProvider(provider);
      return await stockProvider.getKLines(symbol);
    } catch (error) {
      if (this.isAPIError(error)) {
        throw error;
      }

      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch kline series',
        details: { originalError: error }
      };
      throw apiError;
    }
  }
}

// Create new instance for each request to avoid stale state
export function getStockService(): StockService {
  return new StockService();
}
