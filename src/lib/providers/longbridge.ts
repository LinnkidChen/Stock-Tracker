import {
  StockQuote,
  APIError,
  KLineSeries,
  KLineCandle,
  TimeRange
} from '../types/stock-api';
import { logger } from '../logger';
import { StockDataProvider } from './types';
import {
  Config,
  QuoteContext,
  Candlestick,
  Period,
  AdjustType,
  TradeSessions
} from 'longport';

export class LongbridgeProvider implements StockDataProvider {
  name = 'Longbridge';

  async getQuote(symbol: string): Promise<StockQuote> {
    if (
      !process.env.LONGPORT_APP_KEY ||
      !process.env.LONGPORT_APP_SECRET ||
      !process.env.LONGPORT_ACCESS_TOKEN
    ) {
      throw {
        code: 'INVALID_API_KEY',
        message: 'Longbridge credentials not configured'
      } as APIError;
    }

    try {
      const config = Config.fromEnv();
      const context = await QuoteContext.new(config);

      const longbridgeSymbol = this.normalizeSymbol(symbol);
      const quote = await context.quote([longbridgeSymbol]);

      if (!quote || quote.length === 0) {
        throw {
          code: 'INVALID_SYMBOL',
          message: `No quote data found for symbol: ${symbol}`
        } as APIError;
      }

      const q = quote[0];
      const lastUpdated = q.timestamp
        ? q.timestamp.toISOString()
        : new Date().toISOString();

      const price = Number(q.lastDone);
      const prevClose = Number(q.prevClose);
      const change = price - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol: q.symbol,
        name: q.symbol,
        price: price,
        change: change,
        changePercent: changePercent,
        volume: Number(q.volume),
        high: Number(q.high),
        low: Number(q.low),
        open: Number(q.open),
        previousClose: prevClose,
        marketCap: null,
        peRatio: null,
        eps: null,
        dividendYield: null,
        week52High: null,
        week52Low: null,
        avgVolume: null,
        beta: null,
        lastUpdated: lastUpdated
      };
    } catch (error) {
      logger.error('Longbridge Quote Error', { error });

      if (this.isAPIError(error)) {
        throw error;
      }

      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch stock quote from Longbridge',
        details: { originalError: error }
      };
      throw apiError;
    }
  }

  async getKLines(symbol: string): Promise<KLineSeries> {
    if (
      !process.env.LONGPORT_APP_KEY ||
      !process.env.LONGPORT_APP_SECRET ||
      !process.env.LONGPORT_ACCESS_TOKEN
    ) {
      throw {
        code: 'INVALID_API_KEY',
        message: 'Longbridge credentials not configured'
      } as APIError;
    }

    try {
      const config = Config.fromEnv();
      const context = await QuoteContext.new(config);

      const longbridgeSymbol = this.normalizeSymbol(symbol);

      // Fetch daily candles using numeric values to avoid isolatedModules const enum issues
      // Period.Day = 14
      // AdjustType.ForwardAdjust = 1
      // TradeSessions.All = 1
      const candlesData = await context.candlesticks(
        longbridgeSymbol,
        14 as unknown as Period,
        1000,
        1 as unknown as AdjustType,
        1 as unknown as TradeSessions
      );

      return this.transformCandlesticksToSeries(candlesData, symbol);
    } catch (error) {
      logger.error('Longbridge KLine Error', { error });

      if (this.isAPIError(error)) {
        throw error;
      }

      const apiError: APIError = {
        code: 'UNKNOWN_ERROR',
        message: 'Failed to fetch kline series from Longbridge',
        details: { originalError: error }
      };
      throw apiError;
    }
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.includes('.') ? symbol : `${symbol}.US`;
  }

  private transformCandlesticksToSeries(
    candlesData: Candlestick[],
    symbol: string
  ): KLineSeries {
    // Longbridge Candlestick: { close, high, low, open, timestamp, volume, ... }
    // Timestamp is a Date; convert to milliseconds for JS Date usage.

    const candles: KLineCandle[] = candlesData
      .map((c) => ({
        timestamp: c.timestamp.getTime(),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume)
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    let startDate = new Date().toISOString();
    let endDate = new Date().toISOString();

    if (candles.length > 0) {
      startDate = new Date(candles[0].timestamp).toISOString();
      endDate = new Date(candles[candles.length - 1].timestamp).toISOString();
    }

    const range: TimeRange = {
      startDate,
      endDate,
      interval: '1d'
    };

    return {
      symbol,
      range,
      candles,
      lastUpdated: endDate
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
