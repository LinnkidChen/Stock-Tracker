export interface PortfolioHolding {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioHoldingInput {
  symbol: string;
  quantity: number;
  avgCost: number;
}

export type PortfolioTransactionType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'split'
  | 'fee'
  | 'transfer';

export interface PortfolioTransaction {
  id: string;
  userId: string;
  symbol: string;
  type: PortfolioTransactionType;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fee: number;
  splitRatioFrom: number | null;
  splitRatioTo: number | null;
  occurredAt: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioTransactionInput {
  symbol: string;
  type: PortfolioTransactionType;
  quantity?: number;
  price?: number;
  amount?: number;
  fee?: number;
  splitRatioFrom?: number;
  splitRatioTo?: number;
  occurredAt?: string;
  note?: string | null;
}
