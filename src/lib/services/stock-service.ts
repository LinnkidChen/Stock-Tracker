import {
  StockQuote,
  AlphaVantageDailySeriesResponse,
  APIError,
  KLineSeries,
  KLineCandle,
  TimeRange
} from '../types/stock-api';
import { Stock } from '../types';
import { getAlphaVantageClient } from './alpha-vantage-client';
import { QuoteProviderFactory } from './quote-provider';

export class StockService {
  private readonly BATCH_SIZE = 5; // Alpha Vantage free tier limit (5 calls/min)
  private readonly BATCH_DELAY_MS = 61000; // 61 seconds between batches to be safe

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
          errors.push({
            symbol: batch[index],
            error: this.isAPIError(result.reason)
              ? result.reason
              : ({
                  code: 'UNKNOWN_ERROR',
                  message: result.reason?.message || 'Unknown error'
                } as APIError)
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
      const client = this.getClient(); // Keep direct client usage for search for now
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

  private transformAlphaVantageToKLineSeries(
    response: AlphaVantageDailySeriesResponse,
    symbol: string
  ): KLineSeries {
    const series = response['Time Series (Daily)'] ?? {};
    const entries = Object.entries(series);

    const endDate = entries.length
      ? new Date(
          entries.reduce(
            (max, [date]) => (date > max ? date : max),
            entries[0][0]
          )
        )
      : new Date();

    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);

    const parseNumber = (value: string | undefined): number => {
      if (!value || value === 'null' || value === 'None') return 0;
      const parsed = Number.parseFloat(value);
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    const candles: KLineCandle[] = entries
      .map(([date, data]) => {
        const timestamp = new Date(date).getTime();
        return {
          timestamp,
          open: parseNumber(data['1. open']),
          high: parseNumber(data['2. high']),
          low: parseNumber(data['3. low']),
          close: parseNumber(data['4. close']),
          volume: parseNumber(data['5. volume'])
        };
      })
      .filter(
        (candle) =>
          candle.timestamp >= startDate.getTime() &&
          candle.timestamp <= endDate.getTime()
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    const range: TimeRange = {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      interval: '1d'
    };

    return {
      symbol,
      range,
      candles,
      lastUpdated: endDate.toISOString()
    };
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

  private getClient() {
    return getAlphaVantageClient();
  }

  async getQuote(
    symbol: string,
    providerName: string = 'default'
  ): Promise<StockQuote> {
    const provider = QuoteProviderFactory.getProvider(providerName);
    return provider.getQuote(symbol);
  }

  async getKLineSeries(symbol: string): Promise<KLineSeries> {
    try {
      const client = this.getClient();
      const response = await client.fetchDailySeries(symbol);
      return this.transformAlphaVantageToKLineSeries(response, symbol);
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
