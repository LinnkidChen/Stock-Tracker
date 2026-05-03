import { StockProviderFactory } from '../factory';
import {
  AUTO_QUOTE_PROVIDER,
  CANONICAL_QUOTE_PROVIDER,
  LEGACY_DEFAULT_QUOTE_PROVIDER,
  LONGBRIDGE_QUOTE_PROVIDER,
  YAHOO_QUOTE_PROVIDER,
  migrateStoredQuoteProvider,
  resolveQuoteProvider
} from '../config';
import { getProviderRoutingPlan } from '../registry';
import { LongbridgeProvider } from '../longbridge';
import { YahooFinanceProvider } from '../yahoo-finance';

const removedProvider = ['alpha', 'vantage'].join('');

describe('provider config', () => {
  it('resolves omitted input to the auto provider', () => {
    expect(resolveQuoteProvider()).toBe(AUTO_QUOTE_PROVIDER);
    expect(CANONICAL_QUOTE_PROVIDER).toBe(AUTO_QUOTE_PROVIDER);
  });

  it('resolves the legacy default alias to auto fallback routing', () => {
    expect(resolveQuoteProvider(LEGACY_DEFAULT_QUOTE_PROVIDER)).toBe(
      AUTO_QUOTE_PROVIDER
    );
  });

  it('resolves concrete provider IDs', () => {
    expect(resolveQuoteProvider(LONGBRIDGE_QUOTE_PROVIDER)).toBe(
      LONGBRIDGE_QUOTE_PROVIDER
    );
    expect(resolveQuoteProvider(YAHOO_QUOTE_PROVIDER)).toBe(
      YAHOO_QUOTE_PROVIDER
    );
  });

  it('returns null for unsupported provider values', () => {
    expect(resolveQuoteProvider(removedProvider)).toBeNull();
    expect(resolveQuoteProvider('legacy-provider')).toBeNull();
  });

  it('migrates stored provider values to the auto provider by default', () => {
    expect(migrateStoredQuoteProvider(LEGACY_DEFAULT_QUOTE_PROVIDER)).toBe(
      AUTO_QUOTE_PROVIDER
    );
    expect(migrateStoredQuoteProvider('legacy-provider')).toBe(
      AUTO_QUOTE_PROVIDER
    );
  });
});

describe('provider routing', () => {
  it('routes US symbols through Longbridge before Yahoo Finance', () => {
    expect(
      getProviderRoutingPlan({
        symbol: 'AAPL',
        operation: 'quote'
      }).providers
    ).toEqual([LONGBRIDGE_QUOTE_PROVIDER, YAHOO_QUOTE_PROVIDER]);
  });

  it('routes Mainland China symbols through Yahoo Finance before Longbridge', () => {
    expect(
      getProviderRoutingPlan({
        symbol: '600000.SS',
        operation: 'quote'
      }).providers
    ).toEqual([YAHOO_QUOTE_PROVIDER, LONGBRIDGE_QUOTE_PROVIDER]);
  });

  it('honors an explicit concrete provider request', () => {
    expect(
      getProviderRoutingPlan({
        provider: YAHOO_QUOTE_PROVIDER,
        symbol: 'AAPL',
        operation: 'kline',
        interval: 'week'
      }).providers
    ).toEqual([YAHOO_QUOTE_PROVIDER]);
  });
});

describe('StockProviderFactory', () => {
  it('creates an auto fallback provider by default', () => {
    const provider = StockProviderFactory.getProvider();

    expect(provider).toEqual(
      expect.objectContaining({
        id: AUTO_QUOTE_PROVIDER,
        name: 'Auto'
      })
    );
  });

  it('creates a Longbridge provider for the concrete name', () => {
    const provider = StockProviderFactory.getProvider(
      LONGBRIDGE_QUOTE_PROVIDER
    );

    expect(provider).toBeInstanceOf(LongbridgeProvider);
    expect(provider).toEqual(expect.objectContaining({ name: 'Longbridge' }));
  });

  it('creates a Yahoo Finance provider for the concrete name', () => {
    const provider = StockProviderFactory.getProvider(YAHOO_QUOTE_PROVIDER);

    expect(provider).toBeInstanceOf(YahooFinanceProvider);
    expect(provider).toEqual(
      expect.objectContaining({ name: 'Yahoo Finance' })
    );
  });

  it('creates an auto fallback provider for the default alias', () => {
    const provider = StockProviderFactory.getProvider(
      LEGACY_DEFAULT_QUOTE_PROVIDER
    );

    expect(provider).toEqual(
      expect.objectContaining({
        id: AUTO_QUOTE_PROVIDER,
        name: 'Auto'
      })
    );
  });

  it('throws INVALID_PROVIDER for unsupported values', () => {
    expect(() => StockProviderFactory.getProvider(removedProvider)).toThrow(
      expect.objectContaining({
        code: 'INVALID_PROVIDER'
      })
    );

    try {
      StockProviderFactory.getProvider('legacy-provider');
      throw new Error('Expected getProvider to throw');
    } catch (error) {
      expect(error).toEqual(
        expect.objectContaining({
          code: 'INVALID_PROVIDER'
        })
      );
    }
  });
});
