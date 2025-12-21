import { StockQuote, KLineSeries } from '../types/stock-api';

export interface StockDataProvider {
  name: string;
  getQuote(symbol: string): Promise<StockQuote>;
  getKLines(symbol: string): Promise<KLineSeries>;
}
