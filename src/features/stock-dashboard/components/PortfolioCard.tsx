import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Holding {
  symbol: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
}

// Mock portfolio data
const mockHoldings: Holding[] = [
  { symbol: 'AAPL', shares: 10, costBasis: 150, currentPrice: 175 },
  { symbol: 'MSFT', shares: 5, costBasis: 280, currentPrice: 320 },
  { symbol: 'GOOGL', shares: 3, costBasis: 2800, currentPrice: 2650 }
];

export function PortfolioCard() {
  const calculations = useMemo(() => {
    if (mockHoldings.length === 0) {
      return {
        totalValue: 0,
        totalCost: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        isEmpty: true
      };
    }

    let totalValue = 0;
    let totalCost = 0;

    for (const holding of mockHoldings) {
      const marketValue = holding.shares * holding.currentPrice;
      const costValue = holding.shares * holding.costBasis;
      totalValue += marketValue;
      totalCost += costValue;
    }

    const totalPnL = totalValue - totalCost;
    const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalPnL,
      totalPnLPercent,
      isEmpty: false
    };
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (calculations.isEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground text-sm'>
            No holdings yet. Add some positions to see your portfolio overview.
          </div>
        </CardContent>
      </Card>
    );
  }

  const { totalValue, totalPnL, totalPnLPercent } = calculations;
  const isPositive = totalPnL >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <div className='flex items-center justify-between'>
            <span className='text-sm font-medium'>Total Value</span>
            <span className='text-lg font-bold'>
              {formatCurrency(totalValue)}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-sm'>Today's P&L</span>
            <div
              className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(totalPnL)} ({formatPercent(totalPnLPercent)})
            </div>
          </div>
        </div>

        <div className='border-t pt-3'>
          <div className='text-muted-foreground mb-2 text-xs'>
            Holdings ({mockHoldings.length})
          </div>
          <div className='space-y-2'>
            {mockHoldings.slice(0, 3).map((holding) => {
              const marketValue = holding.shares * holding.currentPrice;
              const pnl = marketValue - holding.shares * holding.costBasis;
              const isHoldingPositive = pnl >= 0;

              return (
                <div
                  key={holding.symbol}
                  className='flex items-center justify-between text-sm'
                >
                  <div>
                    <span className='font-medium'>{holding.symbol}</span>
                    <span className='text-muted-foreground ml-1'>
                      ×{holding.shares}
                    </span>
                  </div>
                  <div className='text-right'>
                    <div className='font-medium'>
                      {formatCurrency(marketValue)}
                    </div>
                    <div
                      className={`text-xs ${isHoldingPositive ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {formatCurrency(pnl)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
