export interface WatchlistItem {
  id: string;
  clerk_user_id: string;
  symbol: string;
  exchange?: string;
  note?: string;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export interface WatchlistOperationResult {
  success: boolean;
  data?: {
    watchlist: string[];
  };
  error?: {
    message: string;
  };
}
