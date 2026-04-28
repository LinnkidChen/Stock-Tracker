import {
  derivePortfolioSnapshot,
  NegativePortfolioHoldingError
} from './domain';
import {
  createPortfolioTransaction,
  deletePortfolioTransaction,
  getPortfolioTransactions,
  PortfolioTransactionNotFoundError,
  updatePortfolioTransaction
} from './storage';
import { normalizePortfolioTransactionInput } from './validation';
import type {
  PortfolioSnapshot,
  PortfolioTransaction,
  PortfolioTransactionInput
} from '@/types/portfolio';

export class InvalidPortfolioTransactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPortfolioTransactionError';
  }
}

export { NegativePortfolioHoldingError, PortfolioTransactionNotFoundError };

export interface PortfolioTransactionMutationResult {
  snapshot: PortfolioSnapshot;
  transaction?: PortfolioTransaction;
}

function nowIso(): string {
  return new Date().toISOString();
}

function previewTransaction(
  userId: string,
  input: PortfolioTransactionInput,
  existing?: PortfolioTransaction
): PortfolioTransaction {
  const timestamp = nowIso();

  return {
    id: existing?.id ?? `preview-${timestamp}`,
    userId,
    type: input.type,
    symbol: input.symbol,
    quantity: input.quantity,
    price: input.price,
    amount: input.amount,
    feeAmount: input.feeAmount,
    currency: input.currency,
    transactionDate: input.transactionDate,
    note: input.note,
    realizedPnl: null,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: existing?.updatedAt ?? timestamp
  };
}

function normalizeOrThrow(
  input: PortfolioTransactionInput
): PortfolioTransactionInput {
  const normalized = normalizePortfolioTransactionInput(input);
  if (!normalized.ok) {
    throw new InvalidPortfolioTransactionError(normalized.message);
  }

  return normalized.input;
}

export async function getPortfolioSnapshot(
  userId: string
): Promise<PortfolioSnapshot> {
  const transactions = await getPortfolioTransactions(userId);
  return derivePortfolioSnapshot(transactions, userId);
}

export async function addPortfolioTransaction(
  userId: string,
  input: PortfolioTransactionInput
): Promise<PortfolioTransactionMutationResult> {
  const normalized = normalizeOrThrow(input);
  const currentTransactions = await getPortfolioTransactions(userId);
  derivePortfolioSnapshot(
    [...currentTransactions, previewTransaction(userId, normalized)],
    userId
  );

  const transaction = await createPortfolioTransaction(userId, normalized);
  return {
    transaction,
    snapshot: derivePortfolioSnapshot(
      [...currentTransactions, transaction],
      userId
    )
  };
}

export async function editPortfolioTransaction(
  userId: string,
  id: string,
  input: Partial<PortfolioTransactionInput>
): Promise<PortfolioTransactionMutationResult> {
  const currentTransactions = await getPortfolioTransactions(userId);
  const existing = currentTransactions.find(
    (transaction) => transaction.id === id
  );

  if (!existing) {
    throw new PortfolioTransactionNotFoundError();
  }

  const normalized = normalizeOrThrow({
    type: input.type ?? existing.type,
    symbol: input.symbol !== undefined ? input.symbol : existing.symbol,
    quantity: input.quantity !== undefined ? input.quantity : existing.quantity,
    price: input.price !== undefined ? input.price : existing.price,
    amount: input.amount !== undefined ? input.amount : existing.amount,
    feeAmount:
      input.feeAmount !== undefined ? input.feeAmount : existing.feeAmount,
    currency: input.currency ?? existing.currency,
    transactionDate: input.transactionDate ?? existing.transactionDate,
    note: input.note !== undefined ? input.note : existing.note
  });

  const prospectiveTransactions = currentTransactions.map((transaction) =>
    transaction.id === id
      ? previewTransaction(userId, normalized, transaction)
      : transaction
  );
  derivePortfolioSnapshot(prospectiveTransactions, userId);

  const updated = await updatePortfolioTransaction(userId, id, normalized);
  return {
    transaction: updated,
    snapshot: derivePortfolioSnapshot(
      currentTransactions.map((transaction) =>
        transaction.id === id ? updated : transaction
      ),
      userId
    )
  };
}

export async function removePortfolioTransaction(
  userId: string,
  id: string
): Promise<PortfolioTransactionMutationResult> {
  const currentTransactions = await getPortfolioTransactions(userId);
  const existing = currentTransactions.find(
    (transaction) => transaction.id === id
  );

  if (!existing) {
    throw new PortfolioTransactionNotFoundError();
  }

  const nextTransactions = currentTransactions.filter(
    (transaction) => transaction.id !== id
  );
  derivePortfolioSnapshot(nextTransactions, userId);

  await deletePortfolioTransaction(userId, id);
  return {
    snapshot: derivePortfolioSnapshot(nextTransactions, userId)
  };
}
