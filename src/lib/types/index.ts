export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface PortfolioStock extends Stock {
  quantity: number;
  purchasePrice: number;
}

export interface Portfolio {
  id: string;
  name: string;
  stocks: PortfolioStock[];
  totalValue: number;
}
