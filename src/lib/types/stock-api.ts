import { Stock } from './index';

export interface StockQuote extends Stock {
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  marketCap: number | null;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
  avgVolume: number | null;
  beta: number | null;
  lastUpdated: string;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: APIError | null;
  timestamp: string;
  message?: string;
}

export interface KLineCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimeRange {
  startDate: string;
  endDate: string;
  interval: '1d';
}

export interface KLineSeries {
  symbol: string;
  range: TimeRange;
  candles: KLineCandle[];
  lastUpdated: string;
}

export interface StockNewsItem {
  title: string;
  url: string;
  timePublished: string;
  authors: string[];
  summary: string;
  bannerImage: string | null;
  source: string;
  categoryWithinSource: string;
  sourceDomain: string;
  topics: Array<{
    topic: string;
    relevanceScore: string;
  }>;
  overallSentimentScore: number;
  overallSentimentLabel: string;
  tickerSentiment: Array<{
    ticker: string;
    relevanceScore: string;
    tickerSentimentScore: string;
    tickerSentimentLabel: string;
  }>;
}

export type APIErrorCode =
  | 'INVALID_SYMBOL'
  | 'INVALID_PROVIDER'
  | 'API_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'INVALID_API_KEY'
  | 'UNKNOWN_ERROR';

export interface APIError {
  code: APIErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
