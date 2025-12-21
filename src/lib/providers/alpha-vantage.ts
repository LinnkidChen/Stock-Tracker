import {
  StockQuote,
  APIError,
  AlphaVantageResponse,
  KLineSeries,
  AlphaVantageDailySeriesResponse,
  KLineCandle,
  TimeRange
} from '../types/stock-api';
import { getAlphaVantageClient } from '../services/alpha-vantage-client';
import { logger } from '../logger';
import { StockDataProvider } from './types';

export class AlphaVantageProvider implements StockDataProvider {
  name = 'AlphaVantage';

  async getQuote(symbol: string): Promise<StockQuote> {
    try {
      const client = getAlphaVantageClient();
      const response = await client.fetchQuote(symbol);
      return this.transformAlphaVantageToStockQuote(response, symbol);
    } catch (error) {
      if (this.isAPIError(error)) {
        throw error;
      }

      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote from AlphaVantage',
        details: { originalError: error }
      };
      throw apiError;
    }
  }

  async getKLines(symbol: string): Promise<KLineSeries> {
    try {
      const client = getAlphaVantageClient();
      const response = await client.fetchDailySeries(symbol);
      return this.transformAlphaVantageToKLineSeries(response, symbol);
    } catch (error) {
      if (this.isAPIError(error)) {
        throw error;
      }

      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch kline series from AlphaVantage',
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

    const parseFloatSafe = (
      value: string | undefined,
      fallback: number = 0
    ): number => {
      if (!value || value === 'null' || value === 'None') return fallback;
      const parsed = Number.parseFloat(value);
      if (isNaN(parsed)) {
        if (value && value !== 'null' && value !== 'None' && isNaN(parsed)) {
          logger.warn(`Invalid numeric value received from API: ${value}`, {
            symbol
          });
        }
        return fallback;
      }
      return parsed;
    };

    const changePercentStr = quote['10. change percent'] || '0%';
    const changePercent = parseFloatSafe(changePercentStr.replace('%', ''));

    return {
      symbol: quote['01. symbol'] || symbol,
      name: symbol,
      price: parseFloatSafe(quote['05. price']),
      change: parseFloatSafe(quote['09. change']),
      changePercent,
      volume: parseFloatSafe(quote['06. volume']),
      high: parseFloatSafe(quote['03. high']),
      low: parseFloatSafe(quote['04. low']),
      open: parseFloatSafe(quote['02. open']),
      previousClose: parseFloatSafe(quote['08. previous close']),
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
}
