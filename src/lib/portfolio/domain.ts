import type {
  PortfolioHolding,
  PortfolioSnapshot,
  PortfolioSummary,
  PortfolioTransaction
} from '@/types/portfolio';

const EPSILON = 0.000001;

interface HoldingAccumulator {
  symbol: string;
  quantity: number;
  costBasis: number;
  realizedPnl: number;
  createdAt: string;
  updatedAt: string;
}

export class PortfolioReplayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioReplayError';
  }
}

export class NegativePortfolioHoldingError extends PortfolioReplayError {
  constructor(symbol: string) {
    super(`Transaction would make ${symbol} holdings negative`);
    this.name = 'NegativePortfolioHoldingError';
  }
}

function roundAmount(value: number): number {
  if (Math.abs(value) < EPSILON) return 0;
  return Number(value.toFixed(6));
}

function compareTransactions(
  a: PortfolioTransaction,
  b: PortfolioTransaction
): number {
  const dateCompare =
    Date.parse(a.transactionDate) - Date.parse(b.transactionDate);
  if (dateCompare !== 0) return dateCompare;

  const createdCompare = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (createdCompare !== 0) return createdCompare;

  return a.id.localeCompare(b.id);
}

function createSummary(): PortfolioSummary {
  return {
    currency: 'USD',
    cashBalance: 0,
    holdingsCount: 0,
    investedCost: 0,
    realizedPnl: 0,
    dividends: 0,
    fees: 0,
    deposits: 0,
    withdrawals: 0
  };
}

function getHolding(
  holdingsBySymbol: Map<string, HoldingAccumulator>,
  transaction: PortfolioTransaction
): HoldingAccumulator {
  const symbol = transaction.symbol;
  if (!symbol) {
    throw new PortfolioReplayError('Transaction is missing symbol');
  }

  const normalizedSymbol = symbol.toUpperCase();
  const existing = holdingsBySymbol.get(normalizedSymbol);
  if (existing) {
    existing.updatedAt = transaction.updatedAt;
    return existing;
  }

  const created: HoldingAccumulator = {
    symbol: normalizedSymbol,
    quantity: 0,
    costBasis: 0,
    realizedPnl: 0,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt
  };
  holdingsBySymbol.set(normalizedSymbol, created);
  return created;
}

function requireNumber(value: number | null, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PortfolioReplayError(`Transaction is missing ${fieldName}`);
  }

  return value;
}

export function derivePortfolioSnapshot(
  transactions: PortfolioTransaction[],
  userId: string
): PortfolioSnapshot {
  const orderedTransactions = [...transactions].sort(compareTransactions);
  const holdingsBySymbol = new Map<string, HoldingAccumulator>();
  const realizedByTransactionId = new Map<string, number>();
  const summary = createSummary();

  for (const transaction of orderedTransactions) {
    const feeAmount = transaction.feeAmount || 0;

    if (transaction.type === 'opening_balance' || transaction.type === 'buy') {
      const holding = getHolding(holdingsBySymbol, transaction);
      const quantity = requireNumber(transaction.quantity, 'quantity');
      const price = requireNumber(transaction.price, 'price');
      const cost = quantity * price + feeAmount;

      holding.quantity = roundAmount(holding.quantity + quantity);
      holding.costBasis = roundAmount(holding.costBasis + cost);
      summary.fees = roundAmount(summary.fees + feeAmount);

      if (transaction.type === 'buy') {
        summary.cashBalance = roundAmount(summary.cashBalance - cost);
      }
      continue;
    }

    if (transaction.type === 'sell') {
      const holding = getHolding(holdingsBySymbol, transaction);
      const quantity = requireNumber(transaction.quantity, 'quantity');
      const price = requireNumber(transaction.price, 'price');

      if (holding.quantity + EPSILON < quantity) {
        throw new NegativePortfolioHoldingError(holding.symbol);
      }

      const avgCost =
        holding.quantity > 0 ? holding.costBasis / holding.quantity : 0;
      const removedCost = avgCost * quantity;
      const proceeds = quantity * price;
      const realizedPnl = proceeds - removedCost - feeAmount;

      holding.quantity = roundAmount(holding.quantity - quantity);
      holding.costBasis = roundAmount(holding.costBasis - removedCost);
      holding.realizedPnl = roundAmount(holding.realizedPnl + realizedPnl);
      summary.cashBalance = roundAmount(
        summary.cashBalance + proceeds - feeAmount
      );
      summary.realizedPnl = roundAmount(summary.realizedPnl + realizedPnl);
      summary.fees = roundAmount(summary.fees + feeAmount);
      realizedByTransactionId.set(transaction.id, roundAmount(realizedPnl));
      continue;
    }

    if (transaction.type === 'dividend') {
      const amount = requireNumber(transaction.amount, 'amount');
      summary.dividends = roundAmount(summary.dividends + amount);
      summary.cashBalance = roundAmount(summary.cashBalance + amount);
      continue;
    }

    if (transaction.type === 'deposit') {
      const amount = requireNumber(transaction.amount, 'amount');
      summary.deposits = roundAmount(summary.deposits + amount);
      summary.cashBalance = roundAmount(summary.cashBalance + amount);
      continue;
    }

    if (transaction.type === 'withdrawal') {
      const amount = requireNumber(transaction.amount, 'amount');
      summary.withdrawals = roundAmount(summary.withdrawals + amount);
      summary.cashBalance = roundAmount(summary.cashBalance - amount);
      continue;
    }

    if (transaction.type === 'fee') {
      const amount = requireNumber(transaction.amount, 'amount');
      summary.fees = roundAmount(summary.fees + amount);
      summary.cashBalance = roundAmount(summary.cashBalance - amount);
    }
  }

  const holdings: PortfolioHolding[] = Array.from(holdingsBySymbol.values())
    .filter((holding) => holding.quantity > EPSILON)
    .map((holding) => {
      const costBasis = roundAmount(holding.costBasis);
      return {
        id: `${userId}:${holding.symbol}`,
        userId,
        symbol: holding.symbol,
        quantity: roundAmount(holding.quantity),
        avgCost:
          holding.quantity > EPSILON
            ? roundAmount(costBasis / holding.quantity)
            : 0,
        costBasis,
        realizedPnl: roundAmount(holding.realizedPnl),
        createdAt: holding.createdAt,
        updatedAt: holding.updatedAt
      };
    })
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  summary.holdingsCount = holdings.length;
  summary.investedCost = roundAmount(
    holdings.reduce((total, holding) => total + holding.costBasis, 0)
  );
  summary.cashBalance = roundAmount(summary.cashBalance);
  summary.realizedPnl = roundAmount(summary.realizedPnl);
  summary.dividends = roundAmount(summary.dividends);
  summary.fees = roundAmount(summary.fees);
  summary.deposits = roundAmount(summary.deposits);
  summary.withdrawals = roundAmount(summary.withdrawals);

  return {
    holdings,
    summary,
    transactions: orderedTransactions.map((transaction) => ({
      ...transaction,
      realizedPnl: realizedByTransactionId.get(transaction.id) ?? null
    }))
  };
}
