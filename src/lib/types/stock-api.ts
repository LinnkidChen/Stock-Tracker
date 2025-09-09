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

export interface AlphaVantageGlobalQuote {
  '01. symbol': string;
  '02. open': string;
  '03. high': string;
  '04. low': string;
  '05. price': string;
  '06. volume': string;
  '07. latest trading day': string;
  '08. previous close': string;
  '09. change': string;
  '10. change percent': string;
}

export interface AlphaVantageResponse {
  'Global Quote': AlphaVantageGlobalQuote;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: APIError | null;
  timestamp: string;
  message?: string;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  marketOpen: string;
  marketClose: string;
  timezone: string;
  currency: string;
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
  | 'API_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'INVALID_API_KEY'
  | 'UNKNOWN_ERROR';

export interface APIError {
  code: APIErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
