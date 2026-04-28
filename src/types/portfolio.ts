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
