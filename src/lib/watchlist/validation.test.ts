import {
  validateWatchlistMutationBody,
  validateWatchlistPatchBody
} from './validation';

describe('watchlist validation', () => {
  it('normalizes add metadata', () => {
    const result = validateWatchlistMutationBody({
      action: 'add',
      symbol: 'aapl',
      exchange: ' nasdaq ',
      note: ' Core holding '
    });

    expect(result).toEqual({
      ok: true,
      input: {
        action: 'add',
        symbol: 'AAPL',
        metadata: {
          exchange: 'NASDAQ',
          note: 'Core holding'
        }
      }
    });
  });

  it('rejects invalid metadata', () => {
    const result = validateWatchlistMutationBody({
      action: 'add',
      symbol: 'AAPL',
      note: 'a'.repeat(501)
    });

    expect(result).toEqual({
      ok: false,
      message: 'Note must be 500 characters or less'
    });
  });

  it('validates reorder payloads', () => {
    const result = validateWatchlistPatchBody({
      action: 'reorder',
      items: [
        { symbol: 'msft', sort_order: 0 },
        { symbol: 'aapl', sort_order: 1 }
      ]
    });

    expect(result).toEqual({
      ok: true,
      input: {
        action: 'reorder',
        items: [
          { symbol: 'MSFT', sort_order: 0 },
          { symbol: 'AAPL', sort_order: 1 }
        ]
      }
    });
  });

  it('rejects duplicate reorder symbols', () => {
    const result = validateWatchlistPatchBody({
      action: 'reorder',
      items: [
        { symbol: 'AAPL', sort_order: 0 },
        { symbol: 'aapl', sort_order: 1 }
      ]
    });

    expect(result).toEqual({
      ok: false,
      message: 'Duplicate reorder symbol'
    });
  });
});
