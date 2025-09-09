export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  lastUpdated: Date;
}

export interface Holding {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

export interface WatchlistItem {
  id: string;
  userId: string;
  symbol: string;
  addedAt: Date;
  priceAlert?: number;
  notes?: string;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export enum ChartTimeframe {
  ONE_DAY = '1D',
  ONE_WEEK = '1W',
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  FIVE_YEARS = '5Y'
}

export interface ChartConfig {
  timeframe: ChartTimeframe;
  showVolume: boolean;
  autoScale: boolean;
  theme: 'light' | 'dark';
}

export interface WatchlistItemWithPrice extends WatchlistItem {
  currentPrice?: number;
  change?: number;
  changePercent?: number;
  lastUpdated?: Date;
}

export interface WatchlistPricesMap {
  [symbol: string]: {
    price: number;
    change: number;
    changePercent: number;
    lastUpdated: Date;
  };
}

export interface PriceDisplayConfig {
  showChange: boolean;
  showChangePercent: boolean;
  showVolume: boolean;
  precision: number;
  colorize: boolean;
  compactMode: boolean;
}
