import {
  addToWatchlist,
  getWatchlistItems,
  removeFromWatchlist,
  reorderWatchlistItems,
  updateWatchlistItemMetadata
} from './storage';
import type { WatchlistMutationInput, WatchlistPatchInput } from './validation';
import type { WatchlistItem } from '@/types/watchlist';

export function createWatchlistPayload(items: WatchlistItem[]) {
  return {
    watchlist: items.map((item) => item.symbol),
    items
  };
}

export async function getWatchlistForUser(
  userId: string
): Promise<WatchlistItem[]> {
  return getWatchlistItems(userId);
}

export async function applyWatchlistMutation(
  userId: string,
  input: WatchlistMutationInput
): Promise<WatchlistItem[]> {
  if (input.action === 'add') {
    return addToWatchlist(userId, input.symbol, input.metadata);
  }

  return removeFromWatchlist(userId, input.symbol);
}

export async function applyWatchlistPatch(
  userId: string,
  input: WatchlistPatchInput
): Promise<WatchlistItem[]> {
  if (input.action === 'update') {
    return updateWatchlistItemMetadata(userId, input.symbol, input.metadata);
  }

  return reorderWatchlistItems(userId, input.items);
}
