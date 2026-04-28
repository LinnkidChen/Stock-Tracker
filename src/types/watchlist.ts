export interface WatchlistItem {
  id: string;
  symbol: string;
  exchange: string | null;
  note: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface WatchlistOperationResult {
  success: boolean;
  data?: {
    watchlist: string[];
    items: WatchlistItem[];
  };
  error?: {
    message: string;
  };
}
