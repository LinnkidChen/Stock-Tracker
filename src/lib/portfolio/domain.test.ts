import {
  derivePortfolioSnapshot,
  NegativePortfolioHoldingError
} from './domain';
import type {
  PortfolioTransaction,
  PortfolioTransactionType
} from '@/types/portfolio';

function tx(
  id: string,
  type: PortfolioTransactionType,
  overrides: Partial<PortfolioTransaction> = {}
): PortfolioTransaction {
  return {
    id,
    userId: 'user_123',
    type,
    symbol: null,
    quantity: null,
    price: null,
    amount: null,
    feeAmount: 0,
    currency: 'USD',
    transactionDate: `2026-01-${id.padStart(2, '0')}T00:00:00.000Z`,
    note: null,
    realizedPnl: null,
    createdAt: `2026-01-${id.padStart(2, '0')}T00:00:00.000Z`,
    updatedAt: `2026-01-${id.padStart(2, '0')}T00:00:00.000Z`,
    ...overrides
  };
}

describe('portfolio domain replay', () => {
  it('derives average-cost holdings from opening balances, buys, and fees', () => {
    const snapshot = derivePortfolioSnapshot(
      [
        tx('1', 'opening_balance', {
          symbol: 'AAPL',
          quantity: 10,
          price: 100
        }),
        tx('2', 'buy', {
          symbol: 'AAPL',
          quantity: 5,
          price: 130,
          feeAmount: 5
        })
      ],
      'user_123'
    );

    expect(snapshot.holdings).toEqual([
      expect.objectContaining({
        symbol: 'AAPL',
        quantity: 15,
        costBasis: 1655,
        avgCost: 110.333333
      })
    ]);
    expect(snapshot.summary.fees).toBe(5);
    expect(snapshot.summary.cashBalance).toBe(-655);
  });

  it('computes realized P&L and removes average cost on partial sells', () => {
    const snapshot = derivePortfolioSnapshot(
      [
        tx('1', 'buy', {
          symbol: 'AAPL',
          quantity: 10,
          price: 100
        }),
        tx('2', 'buy', {
          symbol: 'AAPL',
          quantity: 10,
          price: 200
        }),
        tx('3', 'sell', {
          symbol: 'AAPL',
          quantity: 5,
          price: 180,
          feeAmount: 10
        })
      ],
      'user_123'
    );

    expect(snapshot.holdings[0]).toEqual(
      expect.objectContaining({
        quantity: 15,
        costBasis: 2250,
        avgCost: 150,
        realizedPnl: 140
      })
    );
    expect(snapshot.summary.realizedPnl).toBe(140);
    expect(snapshot.transactions[2].realizedPnl).toBe(140);
  });

  it('removes holdings after a full sell', () => {
    const snapshot = derivePortfolioSnapshot(
      [
        tx('1', 'buy', {
          symbol: 'MSFT',
          quantity: 2,
          price: 50
        }),
        tx('2', 'sell', {
          symbol: 'MSFT',
          quantity: 2,
          price: 75
        })
      ],
      'user_123'
    );

    expect(snapshot.holdings).toEqual([]);
    expect(snapshot.summary.realizedPnl).toBe(50);
    expect(snapshot.summary.cashBalance).toBe(50);
  });

  it('tracks dividends, deposits, withdrawals, and standalone fees in cash summary', () => {
    const snapshot = derivePortfolioSnapshot(
      [
        tx('1', 'deposit', { amount: 1000 }),
        tx('2', 'dividend', { symbol: 'AAPL', amount: 25 }),
        tx('3', 'fee', { amount: 5 }),
        tx('4', 'withdrawal', { amount: 200 })
      ],
      'user_123'
    );

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        cashBalance: 820,
        dividends: 25,
        deposits: 1000,
        withdrawals: 200,
        fees: 5
      })
    );
  });

  it('replays backdated transactions by transaction date', () => {
    const snapshot = derivePortfolioSnapshot(
      [
        tx('2', 'sell', {
          symbol: 'NVDA',
          quantity: 1,
          price: 200,
          transactionDate: '2026-01-02T00:00:00.000Z'
        }),
        tx('1', 'buy', {
          symbol: 'NVDA',
          quantity: 2,
          price: 100,
          transactionDate: '2026-01-01T00:00:00.000Z'
        })
      ],
      'user_123'
    );

    expect(snapshot.holdings[0]).toEqual(
      expect.objectContaining({
        symbol: 'NVDA',
        quantity: 1,
        costBasis: 100
      })
    );
    expect(snapshot.summary.realizedPnl).toBe(100);
  });

  it('rejects sells that would make a holding negative', () => {
    expect(() =>
      derivePortfolioSnapshot(
        [
          tx('1', 'buy', {
            symbol: 'AAPL',
            quantity: 1,
            price: 100
          }),
          tx('2', 'sell', {
            symbol: 'AAPL',
            quantity: 2,
            price: 120
          })
        ],
        'user_123'
      )
    ).toThrow(NegativePortfolioHoldingError);
  });
});
