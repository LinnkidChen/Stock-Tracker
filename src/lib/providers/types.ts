import {
  type KLineInterval,
  KLineSeries,
  StockQuote
} from '../types/stock-api';

export interface StockDataProvider {
  name: string;
  getQuote(symbol: string): Promise<StockQuote>;
  getKLines(symbol: string, interval?: KLineInterval): Promise<KLineSeries>;
}
