export type PortfolioTransactionType =
  | 'opening_balance'
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'deposit'
  | 'withdrawal'
  | 'fee';

export type PortfolioCurrency = 'USD';

export interface PortfolioTransaction {
  id: string;
  userId: string;
  type: PortfolioTransactionType;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  feeAmount: number;
  currency: PortfolioCurrency;
  transactionDate: string;
  note: string | null;
  realizedPnl: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioTransactionInput {
  type: PortfolioTransactionType;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  feeAmount: number;
  currency: PortfolioCurrency;
  transactionDate: string;
  note: string | null;
}

export interface PortfolioHolding {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  costBasis: number;
  realizedPnl: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSummary {
  currency: PortfolioCurrency;
  cashBalance: number;
  holdingsCount: number;
  investedCost: number;
  realizedPnl: number;
  dividends: number;
  fees: number;
  deposits: number;
  withdrawals: number;
}

export interface PortfolioSnapshot {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary;
  transactions: PortfolioTransaction[];
}
