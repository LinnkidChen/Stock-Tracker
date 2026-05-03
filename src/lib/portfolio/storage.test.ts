import {
  createPortfolioHolding,
  createPortfolioTransaction,
  deletePortfolioHolding,
  derivePortfolioHoldingsFromTransactions,
  DuplicatePortfolioHoldingError,
  getPortfolioHoldings,
  getPortfolioTransactions,
  PortfolioHoldingNotFoundError,
  PortfolioStorageError,
  updatePortfolioHolding
} from './storage';
import { createClient } from '../supabase/server';
import type { PortfolioTransaction } from '@/types/portfolio';

jest.mock('../supabase/server', () => ({
  createClient: jest.fn()
}));

const now = '2026-01-01T00:00:00.000Z';

function holdingRow(overrides: Record<string, any> = {}) {
  return {
    id: 'holding_1',
    clerk_user_id: 'user_123',
    symbol: 'AAPL',
    quantity: '10',
    avg_cost: '150',
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

function transactionRow(overrides: Record<string, any> = {}) {
  return {
    id: 'transaction_1',
    clerk_user_id: 'user_123',
    symbol: 'AAPL',
    type: 'transfer',
    quantity: '10',
    price: '150',
    amount: null,
    fee: '0',
    split_ratio_from: null,
    split_ratio_to: null,
    occurred_at: now,
    note: null,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

class FakePortfolioQuery {
  private filters: Array<{ column: string; value: any }> = [];
  private orders: Array<{ column: string; ascending?: boolean }> = [];
  private operation: 'select' | 'insert' | 'delete' = 'select';
  private payload: any;

  constructor(
    private table: string,
    private state: {
      holdings: any[];
      transactions: any[];
      nextHoldingId: number;
      nextTransactionId: number;
      failTransactions?: any;
    }
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: options.ascending });
    return this;
  }

  insert(payload: any) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  async upsert(payload: any) {
    const existing = this.state.holdings.find(
      (row) =>
        row.clerk_user_id === payload.clerk_user_id &&
        String(row.symbol).toUpperCase() ===
          String(payload.symbol).toUpperCase()
    );

    if (existing) {
      existing.quantity = payload.quantity;
      existing.avg_cost = payload.avg_cost;
      existing.updated_at = now;
    } else {
      this.state.holdings.push({
        id: `holding_${this.state.nextHoldingId++}`,
        clerk_user_id: payload.clerk_user_id,
        symbol: payload.symbol,
        quantity: payload.quantity,
        avg_cost: payload.avg_cost,
        created_at: now,
        updated_at: now
      });
    }

    return { data: null, error: null };
  }

  async single() {
    const result = this.execute();
    if (result.error) {
      return result;
    }

    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!data) {
      return { data: null, error: { code: 'PGRST116', message: 'No rows' } };
    }

    return { data, error: null };
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute() {
    if (
      this.table === 'stock_portfolio_transactions' &&
      this.state.failTransactions
    ) {
      return { data: null, error: this.state.failTransactions };
    }

    if (this.operation === 'insert') {
      return this.executeInsert();
    }

    if (this.operation === 'delete') {
      return this.executeDelete();
    }

    return { data: this.filteredRows(), error: null };
  }

  private executeInsert() {
    if (this.table !== 'stock_portfolio_transactions') {
      return { data: null, error: { message: 'Unexpected insert' } };
    }

    const row = {
      id: `transaction_${this.state.nextTransactionId++}`,
      clerk_user_id: this.payload.clerk_user_id,
      symbol: this.payload.symbol,
      type: this.payload.type,
      quantity: this.payload.quantity,
      price: this.payload.price,
      amount: this.payload.amount,
      fee: this.payload.fee,
      split_ratio_from: this.payload.split_ratio_from,
      split_ratio_to: this.payload.split_ratio_to,
      occurred_at: this.payload.occurred_at,
      note: this.payload.note,
      created_at: this.payload.occurred_at,
      updated_at: this.payload.occurred_at
    };
    this.state.transactions.push(row);

    return { data: row, error: null };
  }

  private executeDelete() {
    if (this.table !== 'stock_portfolio_holdings') {
      return { data: null, error: { message: 'Unexpected delete' } };
    }

    const before = this.state.holdings.length;
    this.state.holdings = this.state.holdings.filter(
      (row) => !this.matchesFilters(row)
    );

    return {
      data: { deleted: before - this.state.holdings.length },
      error: null
    };
  }

  private filteredRows() {
    const source =
      this.table === 'stock_portfolio_holdings'
        ? this.state.holdings
        : this.state.transactions;
    const rows = source.filter((row) => this.matchesFilters(row));

    return rows.sort((left, right) => {
      for (const order of this.orders) {
        const direction = order.ascending === false ? -1 : 1;
        if (left[order.column] < right[order.column]) return -1 * direction;
        if (left[order.column] > right[order.column]) return 1 * direction;
      }

      return 0;
    });
  }

  private matchesFilters(row: any) {
    return this.filters.every(({ column, value }) => {
      const rowValue = row[column];
      if (typeof rowValue === 'string' && typeof value === 'string') {
        return rowValue.toUpperCase() === value.toUpperCase();
      }

      return rowValue === value;
    });
  }
}

function createFakeSupabase(options: {
  holdings?: any[];
  transactions?: any[];
  failTransactions?: any;
}) {
  const state = {
    holdings: options.holdings ?? [],
    transactions: options.transactions ?? [],
    nextHoldingId: 10,
    nextTransactionId: 10,
    failTransactions: options.failTransactions
  };

  return {
    state,
    client: {
      from: jest.fn((table: string) => new FakePortfolioQuery(table, state))
    }
  };
}

function makeTransaction(
  overrides: Partial<PortfolioTransaction> = {}
): PortfolioTransaction {
  return {
    id: 'transaction_1',
    userId: 'user_123',
    symbol: 'AAPL',
    type: 'buy',
    quantity: 10,
    price: 100,
    amount: null,
    fee: 5,
    splitRatioFrom: null,
    splitRatioTo: null,
    occurredAt: '2026-01-01T00:00:00.000Z',
    note: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('portfolio storage', () => {
  const mockCreateClient = createClient as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('derives current holdings from buy, sell, split, fee, and dividend transactions', () => {
    const holdings = derivePortfolioHoldingsFromTransactions([
      makeTransaction(),
      makeTransaction({
        id: 'transaction_2',
        type: 'sell',
        quantity: 2,
        price: 150,
        fee: 1,
        occurredAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-02T00:00:00.000Z'
      }),
      makeTransaction({
        id: 'transaction_3',
        type: 'split',
        quantity: null,
        price: null,
        fee: 0,
        splitRatioFrom: 1,
        splitRatioTo: 2,
        occurredAt: '2026-01-03T00:00:00.000Z',
        createdAt: '2026-01-03T00:00:00.000Z'
      }),
      makeTransaction({
        id: 'transaction_4',
        type: 'fee',
        quantity: null,
        price: null,
        amount: 10,
        fee: 0,
        occurredAt: '2026-01-04T00:00:00.000Z',
        createdAt: '2026-01-04T00:00:00.000Z'
      }),
      makeTransaction({
        id: 'transaction_5',
        type: 'dividend',
        quantity: null,
        price: null,
        amount: 12,
        fee: 0,
        occurredAt: '2026-01-05T00:00:00.000Z',
        createdAt: '2026-01-05T00:00:00.000Z'
      })
    ]);

    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toEqual(
      expect.objectContaining({
        symbol: 'AAPL',
        quantity: 16
      })
    );
    expect(holdings[0].avgCost).toBeCloseTo(50.875);
  });

  it('fetches holdings derived from ledger transactions while preserving snapshot ids', async () => {
    const fake = createFakeSupabase({
      holdings: [holdingRow()],
      transactions: [transactionRow()]
    });
    mockCreateClient.mockResolvedValue(fake.client);

    const holdings = await getPortfolioHoldings('user_123');

    expect(holdings).toEqual([
      {
        id: 'holding_1',
        userId: 'user_123',
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150,
        createdAt: now,
        updatedAt: now
      }
    ]);
  });

  it('falls back to existing holding snapshots before the ledger is populated', async () => {
    const fake = createFakeSupabase({
      holdings: [holdingRow()],
      transactions: []
    });
    mockCreateClient.mockResolvedValue(fake.client);

    await expect(getPortfolioHoldings('user_123')).resolves.toEqual([
      expect.objectContaining({
        id: 'holding_1',
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150
      })
    ]);
  });

  it('falls back to snapshots if the transaction table is not migrated yet', async () => {
    const fake = createFakeSupabase({
      holdings: [holdingRow()],
      failTransactions: {
        code: '42P01',
        message: 'relation "stock_portfolio_transactions" does not exist'
      }
    });
    mockCreateClient.mockResolvedValue(fake.client);

    await expect(getPortfolioHoldings('user_123')).resolves.toEqual([
      expect.objectContaining({
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150
      })
    ]);
  });

  it('throws a storage error when transaction fetch fails', async () => {
    const fake = createFakeSupabase({
      holdings: [holdingRow()],
      failTransactions: { message: 'database unavailable' }
    });
    mockCreateClient.mockResolvedValue(fake.client);

    await expect(getPortfolioHoldings('user_123')).rejects.toBeInstanceOf(
      PortfolioStorageError
    );
  });

  it('creates a ledger transaction and refreshes the holding snapshot', async () => {
    const fake = createFakeSupabase({
      holdings: [],
      transactions: []
    });
    mockCreateClient.mockResolvedValue(fake.client);

    const transaction = await createPortfolioTransaction('user_123', {
      symbol: 'aapl',
      type: 'buy',
      quantity: 10,
      price: 150,
      fee: 2,
      occurredAt: now
    });

    expect(transaction).toEqual(
      expect.objectContaining({
        symbol: 'AAPL',
        type: 'buy',
        quantity: 10,
        price: 150,
        fee: 2
      })
    );
    expect(fake.state.holdings).toEqual([
      expect.objectContaining({
        symbol: 'AAPL',
        quantity: 10,
        avg_cost: 150.2
      })
    ]);
  });

  it('creates a current holding as a transfer transaction', async () => {
    const fake = createFakeSupabase({
      holdings: [],
      transactions: []
    });
    mockCreateClient.mockResolvedValue(fake.client);

    const holding = await createPortfolioHolding('user_123', {
      symbol: 'aapl',
      quantity: 10,
      avgCost: 150
    });

    expect(holding).toEqual(
      expect.objectContaining({
        symbol: 'AAPL',
        quantity: 10,
        avgCost: 150
      })
    );
    expect(fake.state.transactions).toEqual([
      expect.objectContaining({
        symbol: 'AAPL',
        type: 'transfer',
        quantity: 10,
        price: 150
      })
    ]);
  });

  it('rejects duplicate current holdings from derived positions', async () => {
    const fake = createFakeSupabase({
      holdings: [holdingRow()],
      transactions: [transactionRow()]
    });
    mockCreateClient.mockResolvedValue(fake.client);

    await expect(
      createPortfolioHolding('user_123', {
        symbol: 'AAPL',
        quantity: 5,
        avgCost: 100
      })
    ).rejects.toBeInstanceOf(DuplicatePortfolioHoldingError);
  });

  it('updates a current holding by replacing it with transfer events', async () => {
    const fake = createFakeSupabase({
      holdings: [holdingRow()],
      transactions: [transactionRow()]
    });
    mockCreateClient.mockResolvedValue(fake.client);

    const holding = await updatePortfolioHolding('user_123', 'holding_1', {
      quantity: 5,
      avgCost: 250
    });

    expect(holding).toEqual(
      expect.objectContaining({
        symbol: 'AAPL',
        quantity: 5,
        avgCost: 250
      })
    );
    expect(fake.state.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'transfer',
          quantity: -10,
          price: 150
        }),
        expect.objectContaining({
          type: 'transfer',
          quantity: 5,
          price: 250
        })
      ])
    );
  });

  it('maps not-found update errors', async () => {
    const fake = createFakeSupabase({
      holdings: [],
      transactions: []
    });
    mockCreateClient.mockResolvedValue(fake.client);

    await expect(
      updatePortfolioHolding('user_123', 'missing', { quantity: 5 })
    ).rejects.toBeInstanceOf(PortfolioHoldingNotFoundError);
  });

  it('deletes a current holding by recording a transfer out', async () => {
    const fake = createFakeSupabase({
      holdings: [holdingRow()],
      transactions: [transactionRow()]
    });
    mockCreateClient.mockResolvedValue(fake.client);

    await deletePortfolioHolding('user_123', 'holding_1');

    expect(fake.state.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'transfer',
          quantity: -10,
          price: 150
        })
      ])
    );
    expect(fake.state.holdings).toEqual([]);
  });

  it('fetches ledger transactions for a user', async () => {
    const fake = createFakeSupabase({
      holdings: [],
      transactions: [transactionRow()]
    });
    mockCreateClient.mockResolvedValue(fake.client);

    await expect(getPortfolioTransactions('user_123')).resolves.toEqual([
      expect.objectContaining({
        id: 'transaction_1',
        symbol: 'AAPL',
        type: 'transfer',
        quantity: 10,
        price: 150
      })
    ]);
  });
});
