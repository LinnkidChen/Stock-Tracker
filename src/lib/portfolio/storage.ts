import { createClient } from '../supabase/server';
import type {
  PortfolioHolding,
  PortfolioHoldingInput
} from '@/types/portfolio';

const HOLDING_COLUMNS =
  'id, clerk_user_id, symbol, quantity, avg_cost, created_at, updated_at';

interface PortfolioHoldingRow {
  id: string;
  clerk_user_id: string;
  symbol: string;
  quantity: number | string;
  avg_cost: number | string;
  created_at: string;
  updated_at: string;
}

export class PortfolioStorageError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'PortfolioStorageError';
  }
}

export class DuplicatePortfolioHoldingError extends PortfolioStorageError {
  constructor(originalError?: any) {
    super('Portfolio holding already exists', originalError);
    this.name = 'DuplicatePortfolioHoldingError';
  }
}

export class PortfolioHoldingNotFoundError extends PortfolioStorageError {
  constructor(originalError?: any) {
    super('Portfolio holding not found', originalError);
    this.name = 'PortfolioHoldingNotFoundError';
  }
}

function mapHolding(row: PortfolioHoldingRow): PortfolioHolding {
  return {
    id: row.id,
    userId: row.clerk_user_id,
    symbol: String(row.symbol).toUpperCase(),
    quantity: Number(row.quantity),
    avgCost: Number(row.avg_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isDuplicateError(error: any): boolean {
  return (
    error?.code === '23505' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('duplicate key')
  );
}

function isNotFoundError(error: any): boolean {
  return (
    error?.code === 'PGRST116' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('no rows')
  );
}

export async function getPortfolioHoldings(
  userId: string
): Promise<PortfolioHolding[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_portfolio_holdings')
    .select(HOLDING_COLUMNS)
    .eq('clerk_user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new PortfolioStorageError(
      'Failed to fetch portfolio holdings',
      error
    );
  }

  return (data || []).map((row: PortfolioHoldingRow) => mapHolding(row));
}

export async function createPortfolioHolding(
  userId: string,
  input: PortfolioHoldingInput
): Promise<PortfolioHolding> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_portfolio_holdings')
    .insert({
      clerk_user_id: userId,
      symbol: input.symbol.toUpperCase(),
      quantity: input.quantity,
      avg_cost: input.avgCost
    })
    .select(HOLDING_COLUMNS)
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      throw new DuplicatePortfolioHoldingError(error);
    }

    throw new PortfolioStorageError(
      'Failed to create portfolio holding',
      error
    );
  }

  return mapHolding(data as PortfolioHoldingRow);
}

export async function updatePortfolioHolding(
  userId: string,
  id: string,
  input: Partial<PortfolioHoldingInput>
): Promise<PortfolioHolding> {
  const supabase = await createClient();
  const updates: Record<string, string | number> = {};

  if (input.symbol !== undefined) {
    updates.symbol = input.symbol.toUpperCase();
  }
  if (input.quantity !== undefined) {
    updates.quantity = input.quantity;
  }
  if (input.avgCost !== undefined) {
    updates.avg_cost = input.avgCost;
  }

  const { data, error } = await supabase
    .from('stock_portfolio_holdings')
    .update(updates)
    .eq('clerk_user_id', userId)
    .eq('id', id)
    .select(HOLDING_COLUMNS)
    .single();

  if (error) {
    if (isDuplicateError(error)) {
      throw new DuplicatePortfolioHoldingError(error);
    }
    if (isNotFoundError(error)) {
      throw new PortfolioHoldingNotFoundError(error);
    }

    throw new PortfolioStorageError(
      'Failed to update portfolio holding',
      error
    );
  }

  return mapHolding(data as PortfolioHoldingRow);
}

export async function deletePortfolioHolding(
  userId: string,
  id: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stock_portfolio_holdings')
    .delete()
    .eq('clerk_user_id', userId)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      throw new PortfolioHoldingNotFoundError(error);
    }

    throw new PortfolioStorageError(
      'Failed to delete portfolio holding',
      error
    );
  }
}
