import { createClient } from '../supabase/server';
import type {
  PortfolioCurrency,
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioTransactionType
} from '@/types/portfolio';

const TRANSACTION_COLUMNS =
  'id, clerk_user_id, type, symbol, quantity, price, amount, fee_amount, currency, transaction_date, note, created_at, updated_at';

interface PortfolioTransactionRow {
  id: string;
  clerk_user_id: string;
  type: PortfolioTransactionType;
  symbol: string | null;
  quantity: number | string | null;
  price: number | string | null;
  amount: number | string | null;
  fee_amount: number | string | null;
  currency: PortfolioCurrency;
  transaction_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

type TransactionWrite = {
  type?: PortfolioTransactionType;
  symbol?: string | null;
  quantity?: number | null;
  price?: number | null;
  amount?: number | null;
  fee_amount?: number;
  currency?: PortfolioCurrency;
  transaction_date?: string;
  note?: string | null;
};

export class PortfolioStorageError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'PortfolioStorageError';
  }
}

export class PortfolioTransactionNotFoundError extends PortfolioStorageError {
  constructor(originalError?: any) {
    super('Portfolio transaction not found', originalError);
    this.name = 'PortfolioTransactionNotFoundError';
  }
}

function toNumber(value: number | string | null): number | null {
  if (value === null || value === undefined) return null;
  return Number(value);
}

function mapTransaction(row: PortfolioTransactionRow): PortfolioTransaction {
  return {
    id: row.id,
    userId: row.clerk_user_id,
    type: row.type,
    symbol: row.symbol ? String(row.symbol).toUpperCase() : null,
    quantity: toNumber(row.quantity),
    price: toNumber(row.price),
    amount: toNumber(row.amount),
    feeAmount: Number(row.fee_amount ?? 0),
    currency: row.currency,
    transactionDate: row.transaction_date,
    note: row.note,
    realizedPnl: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function isNotFoundError(error: any): boolean {
  return (
    error?.code === 'PGRST116' ||
    String(error?.message || '')
      .toLowerCase()
      .includes('no rows')
  );
}

function toWrite(input: Partial<PortfolioTransactionInput>): TransactionWrite {
  const write: TransactionWrite = {};

  if (input.type !== undefined) write.type = input.type;
  if (input.symbol !== undefined) {
    write.symbol = input.symbol ? input.symbol.toUpperCase() : null;
  }
  if (input.quantity !== undefined) write.quantity = input.quantity;
  if (input.price !== undefined) write.price = input.price;
  if (input.amount !== undefined) write.amount = input.amount;
  if (input.feeAmount !== undefined) write.fee_amount = input.feeAmount;
  if (input.currency !== undefined) write.currency = input.currency;
  if (input.transactionDate !== undefined) {
    write.transaction_date = input.transactionDate;
  }
  if (input.note !== undefined) write.note = input.note;

  return write;
}

export async function getPortfolioTransactions(
  userId: string
): Promise<PortfolioTransaction[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_portfolio_transactions')
    .select(TRANSACTION_COLUMNS)
    .eq('clerk_user_id', userId)
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw new PortfolioStorageError(
      'Failed to fetch portfolio transactions',
      error
    );
  }

  return (data || []).map((row: PortfolioTransactionRow) =>
    mapTransaction(row)
  );
}

export async function createPortfolioTransaction(
  userId: string,
  input: PortfolioTransactionInput
): Promise<PortfolioTransaction> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_portfolio_transactions')
    .insert({
      clerk_user_id: userId,
      ...toWrite(input)
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

export async function updatePortfolioTransaction(
  userId: string,
  id: string,
  input: PortfolioTransactionInput
): Promise<PortfolioTransaction> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('stock_portfolio_transactions')
    .update(toWrite(input))
    .eq('clerk_user_id', userId)
    .eq('id', id)
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      throw new PortfolioTransactionNotFoundError(error);
    }

    throw new PortfolioStorageError(
      'Failed to update portfolio transaction',
      error
    );
  }

  return mapTransaction(data as PortfolioTransactionRow);
}

export async function deletePortfolioTransaction(
  userId: string,
  id: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('stock_portfolio_transactions')
    .delete()
    .eq('clerk_user_id', userId)
    .eq('id', id)
    .select('id')
    .single();

  if (error) {
    if (isNotFoundError(error)) {
      throw new PortfolioTransactionNotFoundError(error);
    }

    throw new PortfolioStorageError(
      'Failed to delete portfolio transaction',
      error
    );
  }
}
