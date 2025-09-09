import { StockQuote, AlphaVantageResponse, APIError } from '../types/stock-api';
import { Stock } from '../types';
import { getAlphaVantageClient } from './alpha-vantage-client';

export class StockService {
  private readonly BATCH_SIZE = 5; // Alpha Vantage free tier limit
  private readonly BATCH_DELAY_MS = 12000; // 12 seconds between batches

  async getMultipleQuotes(symbols: string[]): Promise<StockQuote[]> {
    const quotes: StockQuote[] = [];
    const errors: Array<{ symbol: string; error: APIError }> = [];

    // Process in batches to respect rate limits
    for (let i = 0; i < symbols.length; i += this.BATCH_SIZE) {
      const batch = symbols.slice(i, i + this.BATCH_SIZE);
      const promises = batch.map((symbol) => this.getQuote(symbol));
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
      const client = this.getClient();
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

  private transformAlphaVantageToStockQuote(
    response: AlphaVantageResponse,
    symbol: string
  ): StockQuote {
    const quote = response['Global Quote'];

    if (!quote) {
      throw {
        code: 'INVALID_SYMBOL',
        message: `No quote data found for symbol: ${symbol}`
      } as APIError;
    }

    // Parse numeric values safely
    const parseFloatSafe = (
      value: string | undefined,
      fallback: number = 0
    ): number => {
      if (!value || value === 'null' || value === 'None') return fallback;
      const parsed = Number.parseFloat(value);
      if (isNaN(parsed)) {
        // Log warning in development only
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn(`Invalid numeric value received from API: ${value}`);
        }
        return fallback;
      }
      return parsed;
    };

    // Parse change percent (remove % sign)
    const changePercentStr = quote['10. change percent'] || '0%';
    const changePercent = parseFloatSafe(changePercentStr.replace('%', ''));

    return {
      symbol: quote['01. symbol'] || symbol,
      name: symbol, // Alpha Vantage doesn't provide company name in Global Quote
      price: parseFloatSafe(quote['05. price']),
      change: parseFloatSafe(quote['09. change']),
      changePercent,
      volume: parseFloatSafe(quote['06. volume']),
      high: parseFloatSafe(quote['03. high']),
      low: parseFloatSafe(quote['04. low']),
      open: parseFloatSafe(quote['02. open']),
      previousClose: parseFloatSafe(quote['08. previous close']),
      // Extended fields - would require additional API calls
      marketCap: null,
      peRatio: null,
      eps: null,
      dividendYield: null,
      week52High: null,
      week52Low: null,
      avgVolume: null,
      beta: null,
      lastUpdated: quote['07. latest trading day'] || new Date().toISOString()
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

  async getQuote(symbol: string): Promise<StockQuote> {
    try {
      const client = this.getClient();
      const response = await client.fetchQuote(symbol);
      return this.transformAlphaVantageToStockQuote(response, symbol);
    } catch (error) {
      // Re-throw APIError as is
      if (this.isAPIError(error)) {
        throw error;
      }

      // Wrap unexpected errors
      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote',
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
