import { createClient } from '../supabase/server';

export class WatchlistStorageError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'WatchlistStorageError';
  }
}

/**
 * Fetches the watchlist symbols for a specific user.
 */
export async function getWatchlist(userId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_watchlist_items')
    .select('symbol')
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new WatchlistStorageError('Failed to fetch watchlist', error);
  }

  return data.map((item: { symbol: string }) => item.symbol);
}

/**
 * Adds a symbol to the user's watchlist.
 * Idempotent: if it exists, it does nothing (due to DB constraint or logic).
 * Returns the updated list of symbols.
 */
export async function addToWatchlist(
  userId: string,
  symbol: string
): Promise<string[]> {
  const supabase = await createClient();

  // "ignoreDuplicates" might verify the unique constraint on (clerk_user_id, symbol)
  const { error } = await supabase
    .from('stock_watchlist_items')
    .upsert(
      { clerk_user_id: userId, symbol: symbol.toUpperCase() },
      { onConflict: 'clerk_user_id,symbol', ignoreDuplicates: true }
    );

  if (error) {
    throw new WatchlistStorageError('Failed to add to watchlist', error);
  }

  return getWatchlist(userId);
}

/**
 * Removes a symbol from the user's watchlist.
 * Returns the updated list of symbols.
 */
export async function removeFromWatchlist(
  userId: string,
  symbol: string
): Promise<string[]> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stock_watchlist_items')
    .delete()
    .eq('clerk_user_id', userId)
    .eq('symbol', symbol.toUpperCase());

  if (error) {
    throw new WatchlistStorageError('Failed to remove from watchlist', error);
  }

  return getWatchlist(userId);
}
