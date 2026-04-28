import { isValidTicker, normalizeTicker } from '@/lib/validation/ticker';

export type WatchlistAction = 'add' | 'remove';
export type WatchlistPatchAction = 'update' | 'reorder';

export interface WatchlistRequestBody {
  action?: unknown;
  symbol?: unknown;
  exchange?: unknown;
  note?: unknown;
}

export interface WatchlistPatchRequestBody {
  action?: unknown;
  symbol?: unknown;
  exchange?: unknown;
  note?: unknown;
  items?: unknown;
}

export interface WatchlistMetadataInput {
  exchange: string | null;
  note: string | null;
}

export interface WatchlistReorderInput {
  symbol: string;
  sort_order: number;
}

export type WatchlistMutationInput =
  | {
      action: 'add';
      symbol: string;
      metadata: WatchlistMetadataInput;
    }
  | {
      action: 'remove';
      symbol: string;
    };

export type WatchlistPatchInput =
  | {
      action: 'update';
      symbol: string;
      metadata: WatchlistMetadataInput;
    }
  | {
      action: 'reorder';
      items: WatchlistReorderInput[];
    };

export type WatchlistValidationResult<T> =
  | { ok: true; input: T }
  | { ok: false; message: string };

function normalizeExchange(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Exchange must be a string');
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function normalizeNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw new Error('Note must be a string');
  }

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) {
    throw new Error('Note must be 500 characters or less');
  }

  return trimmed;
}

function normalizeMetadata(
  exchange: unknown,
  note: unknown
): WatchlistValidationResult<WatchlistMetadataInput> {
  try {
    return {
      ok: true,
      input: {
        exchange: normalizeExchange(exchange),
        note: normalizeNote(note)
      }
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Invalid metadata'
    };
  }
}

function normalizeSymbol(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const symbol = normalizeTicker(value);
  return isValidTicker(symbol) ? symbol : null;
}

export function validateWatchlistMutationBody(
  body: WatchlistRequestBody
): WatchlistValidationResult<WatchlistMutationInput> {
  if (body.action !== 'add' && body.action !== 'remove') {
    return { ok: false, message: "'action' must be 'add' or 'remove'" };
  }

  const symbol = normalizeSymbol(body.symbol);
  if (!symbol) {
    return { ok: false, message: 'Invalid ticker symbol' };
  }

  if (body.action === 'remove') {
    return { ok: true, input: { action: 'remove', symbol } };
  }

  const metadata = normalizeMetadata(body.exchange, body.note);
  if (!metadata.ok) return metadata;

  return {
    ok: true,
    input: {
      action: 'add',
      symbol,
      metadata: metadata.input
    }
  };
}

export function validateWatchlistPatchBody(
  body: WatchlistPatchRequestBody
): WatchlistValidationResult<WatchlistPatchInput> {
  if (body.action === 'update') {
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return { ok: false, message: 'Invalid ticker symbol' };
    }

    const metadata = normalizeMetadata(body.exchange, body.note);
    if (!metadata.ok) return metadata;

    return {
      ok: true,
      input: {
        action: 'update',
        symbol,
        metadata: metadata.input
      }
    };
  }

  if (body.action === 'reorder') {
    if (!Array.isArray(body.items)) {
      return { ok: false, message: "'items' must be an array" };
    }

    const seen = new Set<string>();
    const items: WatchlistReorderInput[] = [];

    for (const item of body.items) {
      if (!item || typeof item !== 'object') {
        return { ok: false, message: 'Invalid reorder item' };
      }

      const candidate = item as { symbol?: unknown; sort_order?: unknown };
      const symbol = normalizeSymbol(candidate.symbol);
      if (!symbol) {
        return { ok: false, message: 'Invalid ticker symbol' };
      }

      const sortOrder = candidate.sort_order;
      if (
        typeof sortOrder !== 'number' ||
        !Number.isSafeInteger(sortOrder) ||
        sortOrder < 0
      ) {
        return {
          ok: false,
          message: 'sort_order must be a non-negative safe integer'
        };
      }

      if (seen.has(symbol)) {
        return { ok: false, message: 'Duplicate reorder symbol' };
      }

      seen.add(symbol);
      items.push({ symbol, sort_order: sortOrder });
    }

    return {
      ok: true,
      input: {
        action: 'reorder',
        items
      }
    };
  }

  return { ok: false, message: "'action' must be 'update' or 'reorder'" };
}
