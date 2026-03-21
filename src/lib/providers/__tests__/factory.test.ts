import { StockProviderFactory } from '../factory';
import {
  CANONICAL_QUOTE_PROVIDER,
  LEGACY_DEFAULT_QUOTE_PROVIDER,
  migrateStoredQuoteProvider,
  resolveQuoteProvider
} from '../config';
import { LongbridgeProvider } from '../longbridge';

jest.mock('../longbridge', () => ({
  LongbridgeProvider: jest.fn().mockImplementation(() => ({
    name: 'Longbridge'
  }))
}));

const MockedLongbridgeProvider = LongbridgeProvider as jest.MockedClass<
  typeof LongbridgeProvider
>;
const removedProvider = ['alpha', 'vantage'].join('');

describe('provider config', () => {
  it('resolves the canonical provider from omitted input', () => {
    expect(resolveQuoteProvider()).toBe(CANONICAL_QUOTE_PROVIDER);
  });

  it('resolves the legacy default alias to Longbridge', () => {
    expect(resolveQuoteProvider(LEGACY_DEFAULT_QUOTE_PROVIDER)).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
  });

  it('returns null for unsupported provider values', () => {
    expect(resolveQuoteProvider(removedProvider)).toBeNull();
    expect(resolveQuoteProvider('legacy-provider')).toBeNull();
  });

  it('migrates stored provider values to the canonical Longbridge value', () => {
    expect(migrateStoredQuoteProvider(LEGACY_DEFAULT_QUOTE_PROVIDER)).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
    expect(migrateStoredQuoteProvider('legacy-provider')).toBe(
      CANONICAL_QUOTE_PROVIDER
    );
  });
});

describe('StockProviderFactory', () => {
  beforeEach(() => {
    MockedLongbridgeProvider.mockClear();
  });

  it('creates a Longbridge provider for the canonical name', () => {
    const provider = StockProviderFactory.getProvider(CANONICAL_QUOTE_PROVIDER);

    expect(MockedLongbridgeProvider).toHaveBeenCalledTimes(1);
    expect(provider).toEqual({ name: 'Longbridge' });
  });

  it('creates a Longbridge provider for the default alias', () => {
    const provider = StockProviderFactory.getProvider(
      LEGACY_DEFAULT_QUOTE_PROVIDER
    );

    expect(MockedLongbridgeProvider).toHaveBeenCalledTimes(1);
    expect(provider).toEqual({ name: 'Longbridge' });
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
