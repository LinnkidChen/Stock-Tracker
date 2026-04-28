import { createClient } from '../supabase/server';
import type { WatchlistItem } from '@/types/watchlist';

export interface WatchlistItemMetadata {
  exchange?: string | null;
  note?: string | null;
}

export interface WatchlistReorderItem {
  symbol: string;
  sort_order: number;
}

export class WatchlistStorageError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'WatchlistStorageError';
  }
}

function toSymbolList(items: WatchlistItem[]): string[] {
  return items.map((item) => item.symbol);
}

/**
 * Fetches full watchlist rows for a specific user.
 */
export async function getWatchlistItems(
  userId: string
): Promise<WatchlistItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_watchlist_items')
    .select('id,symbol,exchange,note,sort_order,created_at,updated_at')
    .eq('clerk_user_id', userId)
    .order('exchange', { ascending: true, nullsFirst: false })
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (error) {
    throw new WatchlistStorageError('Failed to fetch watchlist', error);
  }

  return (data ?? []) as WatchlistItem[];
}

/**
 * Fetches the watchlist symbols for a specific user.
 */
export async function getWatchlist(userId: string): Promise<string[]> {
  return toSymbolList(await getWatchlistItems(userId));
}

/**
 * Adds a symbol to the user's watchlist.
 * Idempotent: if it exists, it does nothing (due to DB constraint or logic).
 * Returns the updated list of symbols.
 */
export async function addToWatchlist(
  userId: string,
  symbol: string,
  metadata: WatchlistItemMetadata = {}
): Promise<WatchlistItem[]> {
  const supabase = await createClient();

  // "ignoreDuplicates" might verify the unique constraint on (clerk_user_id, symbol)
  const { error } = await supabase.from('stock_watchlist_items').upsert(
    {
      clerk_user_id: userId,
      symbol: symbol.toUpperCase(),
      exchange: metadata.exchange ?? null,
      note: metadata.note ?? null
    },
    { onConflict: 'clerk_user_id,symbol', ignoreDuplicates: true }
  );

  if (error) {
    throw new WatchlistStorageError('Failed to add to watchlist', error);
  }

  return getWatchlistItems(userId);
}

/**
 * Removes a symbol from the user's watchlist.
 * Returns the updated list of symbols.
 */
export async function removeFromWatchlist(
  userId: string,
  symbol: string
): Promise<WatchlistItem[]> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stock_watchlist_items')
    .delete()
    .eq('clerk_user_id', userId)
    .eq('symbol', symbol.toUpperCase());

  if (error) {
    throw new WatchlistStorageError('Failed to remove from watchlist', error);
  }

  return getWatchlistItems(userId);
}

/**
 * Updates exchange/note metadata for an existing watchlist item.
 * Returns the updated list of watchlist rows.
 */
export async function updateWatchlistItemMetadata(
  userId: string,
  symbol: string,
  metadata: WatchlistItemMetadata
): Promise<WatchlistItem[]> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stock_watchlist_items')
    .update({
      exchange: metadata.exchange ?? null,
      note: metadata.note ?? null
    })
    .eq('clerk_user_id', userId)
    .eq('symbol', symbol.toUpperCase());

  if (error) {
    throw new WatchlistStorageError('Failed to update watchlist item', error);
  }

  return getWatchlistItems(userId);
}

/**
 * Persists explicit sort orders for watchlist items.
 * Returns the updated list of watchlist rows.
 */
export async function reorderWatchlistItems(
  userId: string,
  items: WatchlistReorderItem[]
): Promise<WatchlistItem[]> {
  const supabase = await createClient();

  for (const item of items) {
    const { error } = await supabase
      .from('stock_watchlist_items')
      .update({ sort_order: item.sort_order })
      .eq('clerk_user_id', userId)
      .eq('symbol', item.symbol.toUpperCase());

    if (error) {
      throw new WatchlistStorageError('Failed to reorder watchlist', error);
    }
  }

  return getWatchlistItems(userId);
}
