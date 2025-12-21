import { StockQuote, APIError, AlphaVantageResponse } from '../types/stock-api';
import { getAlphaVantageClient } from './alpha-vantage-client';
import { logger } from '../logger';
import { Config, QuoteContext } from 'longport';

export interface QuoteProvider {
  getQuote(symbol: string): Promise<StockQuote>;
  name: string;
}

export class AlphaVantageQuoteProvider implements QuoteProvider {
  name = 'AlphaVantage';

  async getQuote(symbol: string): Promise<StockQuote> {
    try {
      const client = getAlphaVantageClient();
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
        message: 'Failed to fetch stock quote from AlphaVantage',
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
        if (value && value !== 'null' && value !== 'None' && isNaN(parsed)) {
          logger.warn(`Invalid numeric value received from API: ${value}`, {
            symbol
          });
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
}

export class LongbridgeQuoteProvider implements QuoteProvider {
  name = 'Longbridge';

  async getQuote(symbol: string): Promise<StockQuote> {
    // Only initialize if environment variables are present to avoid startup crashes
    if (!process.env.LONGPORT_APP_KEY || !process.env.LONGPORT_ACCESS_TOKEN) {
      throw {
        code: 'INVALID_API_KEY',
        message: 'Longbridge credentials not configured'
      } as APIError;
    }

    try {
      const config = Config.fromEnv();
      const context = await QuoteContext.new(config);

      // Longbridge uses "US.AAPL" format, but our app uses "AAPL"
      // We need to guess the market or default to US for now.
      // Or simply try passing the symbol and hope SDK handles it?
      // Typically it requires Market.Symbol like 'US.AAPL' or 'HK.00700'
      // Let's assume US for now if no dot is present, or try to detect.
      const longbridgeSymbol = symbol.includes('.') ? symbol : `US.${symbol}`;

      const quote = await context.quote([longbridgeSymbol]);

      if (!quote || quote.length === 0) {
        throw {
          code: 'INVALID_SYMBOL',
          message: `No quote data found for symbol: ${symbol}`
        } as APIError;
      }

      const q = quote[0];

      // Format: 2023-10-27
      const lastUpdated = q.timestamp
        ? new Date(Number(q.timestamp) * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      return {
        symbol: q.symbol,
        name: q.symbol, // We might want to fetch name separately e.g. from static info
        price: Number(q.lastDone),
        change: Number(q.change), // absolute change
        changePercent: Number(q.changeRate) * 100, // typically 0.0123 -> 1.23
        volume: Number(q.volume),
        high: Number(q.high),
        low: Number(q.low),
        open: Number(q.open),
        previousClose: Number(q.prevClose),
        marketCap: Number(q.totalMarketValue),
        peRatio: Number(q.peTtm), // or similar field
        eps: null, // need to check if available
        dividendYield: Number(q.dividendYield) * 100,
        week52High: Number(q.high52Week),
        week52Low: Number(q.low52Week),
        avgVolume: null,
        beta: null,
        lastUpdated: lastUpdated
      };
    } catch (error) {
      logger.error('Longbridge Quote Error', { error });
      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote from Longbridge',
        details: { originalError: error }
      };
      throw apiError;
    }
  }
}

export class QuoteProviderFactory {
  static getProvider(name: string): QuoteProvider {
    switch (name.toLowerCase()) {
      case 'longbridge':
        return new LongbridgeQuoteProvider();
      case 'default':
      case 'alphavantage':
      default:
        return new AlphaVantageQuoteProvider();
    }
  }
}
