import { createClient } from '../supabase/server';
import type {
  PortfolioHolding,
  PortfolioHoldingInput,
  PortfolioTransaction,
  PortfolioTransactionInput
} from '@/types/portfolio';

const HOLDING_COLUMNS =
  'id, clerk_user_id, symbol, quantity, avg_cost, created_at, updated_at';
const TRANSACTION_COLUMNS =
  'id, clerk_user_id, symbol, type, quantity, price, amount, fee, split_ratio_from, split_ratio_to, occurred_at, note, created_at, updated_at';
const DERIVED_HOLDING_ID_PREFIX = 'derived:';
const POSITION_EPSILON = 0.0000005;

interface PortfolioHoldingRow {
  id: string;
  clerk_user_id: string;
  symbol: string;
  quantity: number | string;
  avg_cost: number | string;
  created_at: string;
  updated_at: string;
}

interface PortfolioTransactionRow {
  id: string;
  clerk_user_id: string;
  symbol: string;
  type: PortfolioTransaction['type'];
  quantity: number | string | null;
  price: number | string | null;
  amount: number | string | null;
  fee: number | string | null;
  split_ratio_from: number | string | null;
  split_ratio_to: number | string | null;
  occurred_at: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface PositionState {
  userId: string;
  symbol: string;
  quantity: number;
  costBasis: number;
  createdAt: string;
  updatedAt: string;
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

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
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

function mapTransaction(row: PortfolioTransactionRow): PortfolioTransaction {
  return {
    id: row.id,
    userId: row.clerk_user_id,
    symbol: String(row.symbol).toUpperCase(),
    type: row.type,
    quantity: toNumber(row.quantity),
    price: toNumber(row.price),
    amount: toNumber(row.amount),
    fee: toNumber(row.fee) ?? 0,
    splitRatioFrom: toNumber(row.split_ratio_from),
    splitRatioTo: toNumber(row.split_ratio_to),
    occurredAt: row.occurred_at,
    note: row.note,
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

function isMissingLedgerTableError(error: any): boolean {
  const originalError = error?.originalError || error;
  return (
    originalError?.code === '42P01' ||
    String(originalError?.message || '').includes(
      'stock_portfolio_transactions'
    )
  );
}

function getState(
  states: Map<string, PositionState>,
  transaction: PortfolioTransaction
): PositionState {
  const symbol = transaction.symbol.toUpperCase();
  const existing = states.get(symbol);
  if (existing) {
    return existing;
  }

  const state = {
    userId: transaction.userId,
    symbol,
    quantity: 0,
    costBasis: 0,
    createdAt: transaction.occurredAt,
    updatedAt: transaction.updatedAt
  };
  states.set(symbol, state);
  return state;
}

function reducePosition(state: PositionState, quantity: number) {
  if (quantity <= 0) {
    return;
  }

  if (state.quantity <= POSITION_EPSILON) {
    state.quantity -= quantity;
    state.costBasis = 0;
    return;
  }

  const averageCost = state.costBasis / state.quantity;
  const coveredQuantity = Math.min(quantity, state.quantity);
  state.quantity -= quantity;
  state.costBasis -= averageCost * coveredQuantity;

  if (state.quantity <= POSITION_EPSILON) {
    state.costBasis = 0;
  }
}

export function derivePortfolioHoldingsFromTransactions(
  transactions: PortfolioTransaction[]
): PortfolioHolding[] {
  const states = new Map<string, PositionState>();
  const orderedTransactions = [...transactions].sort((left, right) => {
    const occurredAt =
      new Date(left.occurredAt).getTime() -
      new Date(right.occurredAt).getTime();
    if (occurredAt !== 0) {
      return occurredAt;
    }

    return (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  });

  for (const transaction of orderedTransactions) {
    const state = getState(states, transaction);
    state.updatedAt = transaction.updatedAt;

    if (transaction.type === 'buy') {
      const quantity = transaction.quantity ?? 0;
      const price = transaction.price ?? 0;
      state.quantity += quantity;
      state.costBasis += quantity * price + transaction.fee;
      continue;
    }

    if (transaction.type === 'sell') {
      reducePosition(state, transaction.quantity ?? 0);
      continue;
    }

    if (transaction.type === 'transfer') {
      const quantity = transaction.quantity ?? 0;
      if (quantity > 0) {
        state.quantity += quantity;
        state.costBasis +=
          quantity * (transaction.price ?? 0) + transaction.fee;
      } else {
        reducePosition(state, Math.abs(quantity));
      }
      continue;
    }

    if (transaction.type === 'split') {
      const splitFrom = transaction.splitRatioFrom ?? 0;
      const splitTo = transaction.splitRatioTo ?? 0;
      if (splitFrom > 0 && splitTo > 0) {
        state.quantity *= splitTo / splitFrom;
      }
      continue;
    }

    if (transaction.type === 'fee' && state.quantity > POSITION_EPSILON) {
      state.costBasis += transaction.amount ?? 0;
    }
  }

  return Array.from(states.values())
    .filter((state) => state.quantity > POSITION_EPSILON)
    .map((state) => ({
      id: `${DERIVED_HOLDING_ID_PREFIX}${state.symbol}`,
      userId: state.userId,
      symbol: state.symbol,
      quantity: state.quantity,
      avgCost: state.costBasis / state.quantity,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt
    }));
}

async function fetchHoldingRows(
  supabase: any,
  userId: string
): Promise<PortfolioHoldingRow[]> {
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

  return data || [];
}

async function fetchTransactionRows(
  supabase: any,
  userId: string
): Promise<PortfolioTransactionRow[]> {
  const { data, error } = await supabase
    .from('stock_portfolio_transactions')
    .select(TRANSACTION_COLUMNS)
    .eq('clerk_user_id', userId)
    .order('occurred_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw new PortfolioStorageError(
      'Failed to fetch portfolio transactions',
      error
    );
  }

  return data || [];
}

function mergeDerivedHoldingsWithSnapshots(
  derivedHoldings: PortfolioHolding[],
  snapshotRows: PortfolioHoldingRow[],
  transactions: PortfolioTransaction[]
): PortfolioHolding[] {
  const snapshotsBySymbol = new Map(
    snapshotRows.map((row) => {
      const holding = mapHolding(row);
      return [holding.symbol, holding] as const;
    })
  );
  const transactionSymbols = new Set(
    transactions.map((transaction) => transaction.symbol)
  );
  const derivedSymbols = new Set(
    derivedHoldings.map((holding) => holding.symbol)
  );

  const derivedWithSnapshotIds = derivedHoldings.map((holding) => {
    const snapshot = snapshotsBySymbol.get(holding.symbol);
    if (!snapshot) {
      return holding;
    }

    return {
      ...holding,
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt
    };
  });

  const legacySnapshots = Array.from(snapshotsBySymbol.values()).filter(
    (holding) =>
      !transactionSymbols.has(holding.symbol) &&
      !derivedSymbols.has(holding.symbol)
  );

  return [...derivedWithSnapshotIds, ...legacySnapshots];
}

async function getPortfolioHoldingsForClient(
  supabase: any,
  userId: string
): Promise<PortfolioHolding[]> {
  const snapshotRows = await fetchHoldingRows(supabase, userId);

  let transactionRows: PortfolioTransactionRow[];
  try {
    transactionRows = await fetchTransactionRows(supabase, userId);
  } catch (error) {
    if (isMissingLedgerTableError(error)) {
      return snapshotRows.map((row) => mapHolding(row));
    }

    throw error;
  }

  if (transactionRows.length === 0) {
    return snapshotRows.map((row) => mapHolding(row));
  }

  const transactions = transactionRows.map((row) => mapTransaction(row));
  const derivedHoldings = derivePortfolioHoldingsFromTransactions(transactions);

  return mergeDerivedHoldingsWithSnapshots(
    derivedHoldings,
    snapshotRows,
    transactions
  );
}

async function upsertHoldingSnapshot(
  supabase: any,
  userId: string,
  holding: PortfolioHolding
) {
  const { error } = await supabase.from('stock_portfolio_holdings').upsert(
    {
      clerk_user_id: userId,
      symbol: holding.symbol,
      quantity: holding.quantity,
      avg_cost: holding.avgCost
    },
    { onConflict: 'clerk_user_id,symbol' }
  );

  if (error) {
    if (isDuplicateError(error)) {
      throw new DuplicatePortfolioHoldingError(error);
    }

    throw new PortfolioStorageError(
      'Failed to refresh portfolio holding snapshot',
      error
    );
  }
}

async function deleteHoldingSnapshot(
  supabase: any,
  userId: string,
  symbol: string
) {
  const { error } = await supabase
    .from('stock_portfolio_holdings')
    .delete()
    .eq('clerk_user_id', userId)
    .eq('symbol', symbol);

  if (error) {
    throw new PortfolioStorageError(
      'Failed to remove portfolio holding snapshot',
      error
    );
  }
}

async function refreshHoldingSnapshots(
  supabase: any,
  userId: string,
  symbols: string[]
) {
  const normalizedSymbols = Array.from(
    new Set(symbols.map((symbol) => symbol.toUpperCase()))
  );
  const transactions = (await fetchTransactionRows(supabase, userId)).map(
    (row) => mapTransaction(row)
  );
  const derivedHoldings = derivePortfolioHoldingsFromTransactions(transactions);
  const derivedBySymbol = new Map(
    derivedHoldings.map((holding) => [holding.symbol, holding] as const)
  );

  for (const symbol of normalizedSymbols) {
    const holding = derivedBySymbol.get(symbol);
    if (holding) {
      await upsertHoldingSnapshot(supabase, userId, holding);
    } else {
      await deleteHoldingSnapshot(supabase, userId, symbol);
    }
  }
}

async function insertPortfolioTransaction(
  supabase: any,
  userId: string,
  input: PortfolioTransactionInput
): Promise<PortfolioTransaction> {
  const { data, error } = await supabase
    .from('stock_portfolio_transactions')
    .insert({
      clerk_user_id: userId,
      symbol: input.symbol.toUpperCase(),
      type: input.type,
      quantity: input.quantity ?? null,
      price: input.price ?? null,
      amount: input.amount ?? null,
      fee: input.fee ?? 0,
      split_ratio_from: input.splitRatioFrom ?? null,
      split_ratio_to: input.splitRatioTo ?? null,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
      note: input.note ?? null
    })
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) {
    throw new PortfolioStorageError(
      'Failed to create portfolio transaction',
      error
    );
  }

  return mapTransaction(data as PortfolioTransactionRow);
}

function findHoldingByIdOrDerivedSymbol(
  holdings: PortfolioHolding[],
  id: string
): PortfolioHolding | undefined {
  const byId = holdings.find((holding) => holding.id === id);
  if (byId) {
    return byId;
  }

  if (id.startsWith(DERIVED_HOLDING_ID_PREFIX)) {
    const symbol = id.slice(DERIVED_HOLDING_ID_PREFIX.length).toUpperCase();
    return holdings.find((holding) => holding.symbol === symbol);
  }

  return undefined;
}

function findHoldingForSymbol(
  holdings: PortfolioHolding[],
  symbol: string
): PortfolioHolding | undefined {
  const normalizedSymbol = symbol.toUpperCase();
  return holdings.find((holding) => holding.symbol === normalizedSymbol);
}

export async function getPortfolioHoldings(
  userId: string
): Promise<PortfolioHolding[]> {
  const supabase = await createClient();
  return getPortfolioHoldingsForClient(supabase, userId);
}

export async function getPortfolioTransactions(
  userId: string
): Promise<PortfolioTransaction[]> {
  const supabase = await createClient();
  const rows = await fetchTransactionRows(supabase, userId);
  return rows.map((row) => mapTransaction(row));
}

export async function createPortfolioTransaction(
  userId: string,
  input: PortfolioTransactionInput
): Promise<PortfolioTransaction> {
  const supabase = await createClient();
  const transaction = await insertPortfolioTransaction(supabase, userId, input);
  await refreshHoldingSnapshots(supabase, userId, [transaction.symbol]);

  return transaction;
}

export async function createPortfolioHolding(
  userId: string,
  input: PortfolioHoldingInput
): Promise<PortfolioHolding> {
  const supabase = await createClient();
  const symbol = input.symbol.toUpperCase();
  const currentHoldings = await getPortfolioHoldingsForClient(supabase, userId);

  if (findHoldingForSymbol(currentHoldings, symbol)) {
    throw new DuplicatePortfolioHoldingError();
  }

  const transaction = await insertPortfolioTransaction(supabase, userId, {
    symbol,
    type: 'transfer',
    quantity: input.quantity,
    price: input.avgCost,
    note: 'Created current position'
  });
  await refreshHoldingSnapshots(supabase, userId, [transaction.symbol]);

  const holdings = await getPortfolioHoldingsForClient(supabase, userId);
  const holding = findHoldingForSymbol(holdings, symbol);
  if (!holding) {
    throw new PortfolioStorageError(
      'Failed to derive created portfolio holding'
    );
  }

  return holding;
}

export async function updatePortfolioHolding(
  userId: string,
  id: string,
  input: Partial<PortfolioHoldingInput>
): Promise<PortfolioHolding> {
  const supabase = await createClient();
  const currentHoldings = await getPortfolioHoldingsForClient(supabase, userId);
  const currentHolding = findHoldingByIdOrDerivedSymbol(currentHoldings, id);

  if (!currentHolding) {
    throw new PortfolioHoldingNotFoundError();
  }

  const targetSymbol = (input.symbol ?? currentHolding.symbol).toUpperCase();
  const targetQuantity = input.quantity ?? currentHolding.quantity;
  const targetAvgCost = input.avgCost ?? currentHolding.avgCost;
  const duplicate = currentHoldings.find(
    (holding) =>
      holding.symbol === targetSymbol && holding.id !== currentHolding.id
  );

  if (duplicate) {
    throw new DuplicatePortfolioHoldingError();
  }

  if (
    currentHolding.symbol === targetSymbol &&
    currentHolding.quantity === targetQuantity &&
    currentHolding.avgCost === targetAvgCost
  ) {
    return currentHolding;
  }

  const occurredAt = new Date();
  await insertPortfolioTransaction(supabase, userId, {
    symbol: currentHolding.symbol,
    type: 'transfer',
    quantity: -currentHolding.quantity,
    price: currentHolding.avgCost,
    occurredAt: occurredAt.toISOString(),
    note: 'Replaced current position'
  });
  await insertPortfolioTransaction(supabase, userId, {
    symbol: targetSymbol,
    type: 'transfer',
    quantity: targetQuantity,
    price: targetAvgCost,
    occurredAt: new Date(occurredAt.getTime() + 1).toISOString(),
    note: 'Updated current position'
  });

  await refreshHoldingSnapshots(supabase, userId, [
    currentHolding.symbol,
    targetSymbol
  ]);

  const holdings = await getPortfolioHoldingsForClient(supabase, userId);
  const holding = findHoldingForSymbol(holdings, targetSymbol);
  if (!holding) {
    throw new PortfolioStorageError(
      'Failed to derive updated portfolio holding'
    );
  }

  return holding;
}

export async function deletePortfolioHolding(
  userId: string,
  id: string
): Promise<void> {
  const supabase = await createClient();
  const currentHoldings = await getPortfolioHoldingsForClient(supabase, userId);
  const currentHolding = findHoldingByIdOrDerivedSymbol(currentHoldings, id);

  if (!currentHolding) {
    throw new PortfolioHoldingNotFoundError();
  }

  await insertPortfolioTransaction(supabase, userId, {
    symbol: currentHolding.symbol,
    type: 'transfer',
    quantity: -currentHolding.quantity,
    price: currentHolding.avgCost,
    note: 'Deleted current position'
  });
  await refreshHoldingSnapshots(supabase, userId, [currentHolding.symbol]);
}
