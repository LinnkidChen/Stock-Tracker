import {
  AUTO_QUOTE_PROVIDER,
  LONGBRIDGE_QUOTE_PROVIDER,
  YAHOO_QUOTE_PROVIDER,
  resolveQuoteProvider
} from './config';
import {
  ConcreteProviderId,
  ProviderId,
  ProviderMetadata,
  ProviderOperation,
  ProviderRoutingPlan,
  StockDataProvider
} from './types';
import {
  LongbridgeProvider,
  LONGBRIDGE_PROVIDER_CAPABILITIES
} from './longbridge';
import {
  YahooFinanceProvider,
  YAHOO_PROVIDER_CAPABILITIES
} from './yahoo-finance';
import { APIError, type KLineInterval } from '../types/stock-api';

interface ProviderRegistryEntry extends ProviderMetadata {
  createProvider: () => StockDataProvider;
}

interface SymbolRoute {
  market: string;
  matches: (symbol: string) => boolean;
  providers: ConcreteProviderId[];
  reason: string;
}

const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  {
    id: LONGBRIDGE_QUOTE_PROVIDER,
    name: 'Longbridge',
    label: 'Longbridge',
    fallbackRank: 10,
    capabilities: LONGBRIDGE_PROVIDER_CAPABILITIES,
    createProvider: () => new LongbridgeProvider()
  },
  {
    id: YAHOO_QUOTE_PROVIDER,
    name: 'Yahoo Finance',
    label: 'Yahoo Finance',
    fallbackRank: 20,
    capabilities: YAHOO_PROVIDER_CAPABILITIES,
    createProvider: () => new YahooFinanceProvider()
  }
];

const SYMBOL_ROUTES: SymbolRoute[] = [
  {
    market: 'US',
    matches: (symbol) => isBareUSSymbol(symbol) || symbol.endsWith('.US'),
    providers: [LONGBRIDGE_QUOTE_PROVIDER, YAHOO_QUOTE_PROVIDER],
    reason: 'US symbols prefer Longbridge with Yahoo Finance fallback.'
  },
  {
    market: 'HK',
    matches: (symbol) => symbol.endsWith('.HK'),
    providers: [LONGBRIDGE_QUOTE_PROVIDER, YAHOO_QUOTE_PROVIDER],
    reason: 'Hong Kong symbols prefer Longbridge with Yahoo Finance fallback.'
  },
  {
    market: 'CN',
    matches: (symbol) =>
      symbol.endsWith('.SS') ||
      symbol.endsWith('.SZ') ||
      symbol.endsWith('.CN'),
    providers: [YAHOO_QUOTE_PROVIDER, LONGBRIDGE_QUOTE_PROVIDER],
    reason:
      'Mainland China symbols prefer Yahoo Finance with Longbridge fallback.'
  },
  {
    market: 'GLOBAL',
    matches: () => true,
    providers: [YAHOO_QUOTE_PROVIDER, LONGBRIDGE_QUOTE_PROVIDER],
    reason:
      'Unqualified global symbols prefer Yahoo Finance with Longbridge fallback.'
  }
];

export function listProviderMetadata(): ProviderMetadata[] {
  return PROVIDER_REGISTRY.map((provider) => ({
    id: provider.id,
    name: provider.name,
    label: provider.label,
    fallbackRank: provider.fallbackRank,
    capabilities: provider.capabilities
  }));
}

export function getFallbackOrder(): ConcreteProviderId[] {
  return [...PROVIDER_REGISTRY]
    .sort((a, b) => a.fallbackRank - b.fallbackRank)
    .map((provider) => provider.id);
}

export function createRegisteredProvider(
  id: ConcreteProviderId
): StockDataProvider {
  const entry = getProviderEntry(id);
  return entry.createProvider();
}

export function getProviderRoutingPlan(options: {
  provider?: string | null;
  symbol: string;
  operation: ProviderOperation;
  interval?: KLineInterval;
}): ProviderRoutingPlan {
  const requestedProvider = resolveProviderOrThrow(options.provider);
  const symbol = normalizeSymbol(options.symbol);

  if (requestedProvider !== AUTO_QUOTE_PROVIDER) {
    const entry = getProviderEntry(requestedProvider);
    assertSupportsOperation(entry, options.operation, options.interval);

    return {
      requestedProvider,
      operation: options.operation,
      symbol,
      market: getMarketForSymbol(symbol),
      providers: [requestedProvider],
      reason: `Explicit provider requested: ${entry.label}.`
    };
  }

  const route = getSymbolRoute(symbol);
  const routedProviders = route.providers.filter((id) =>
    providerSupports(id, route.market, options.operation, options.interval)
  );
  const fallbackProviders = getFallbackOrder().filter(
    (id) =>
      !routedProviders.includes(id) &&
      providerSupports(id, route.market, options.operation, options.interval)
  );
  const providers = [...routedProviders, ...fallbackProviders];

  if (providers.length === 0) {
    throw {
      code: 'INVALID_PROVIDER',
      message: `No market data providers support ${options.operation} for ${symbol}`,
      details: {
        symbol,
        operation: options.operation,
        market: route.market
      }
    } as APIError;
  }

  return {
    requestedProvider,
    operation: options.operation,
    symbol,
    market: route.market,
    providers,
    reason: route.reason
  };
}

export function resolveProviderOrThrow(value?: string | null): ProviderId {
  const provider = resolveQuoteProvider(value);

  if (!provider) {
    throw {
      code: 'INVALID_PROVIDER',
      message: `Unsupported provider: ${value}`
    } as APIError;
  }

  return provider;
}

function getProviderEntry(id: ConcreteProviderId): ProviderRegistryEntry {
  const entry = PROVIDER_REGISTRY.find((provider) => provider.id === id);

  if (!entry) {
    throw {
      code: 'INVALID_PROVIDER',
      message: `Unsupported provider: ${id}`
    } as APIError;
  }

  return entry;
}

function providerSupports(
  id: ConcreteProviderId,
  market: string,
  operation: ProviderOperation,
  interval?: KLineInterval
): boolean {
  const entry = getProviderEntry(id);
  const supportsMarket =
    entry.capabilities.markets.includes(market) ||
    entry.capabilities.markets.includes('GLOBAL');

  return (
    supportsMarket &&
    supportsOperation(entry, operation) &&
    supportsInterval(entry, operation, interval)
  );
}

function assertSupportsOperation(
  entry: ProviderRegistryEntry,
  operation: ProviderOperation,
  interval?: KLineInterval
) {
  if (
    !supportsOperation(entry, operation) ||
    !supportsInterval(entry, operation, interval)
  ) {
    throw {
      code: 'INVALID_PROVIDER',
      message: `${entry.label} does not support ${operation} requests`,
      details: {
        provider: entry.id,
        operation,
        interval
      }
    } as APIError;
  }
}

function supportsOperation(
  entry: ProviderRegistryEntry,
  operation: ProviderOperation
): boolean {
  return operation === 'quote'
    ? entry.capabilities.quotes
    : entry.capabilities.kLines;
}

function supportsInterval(
  entry: ProviderRegistryEntry,
  operation: ProviderOperation,
  interval?: KLineInterval
): boolean {
  if (operation !== 'kline' || !interval) {
    return true;
  }

  return entry.capabilities.intervals.includes(interval);
}

function getSymbolRoute(symbol: string): SymbolRoute {
  return SYMBOL_ROUTES.find((route) => route.matches(symbol))!;
}

function getMarketForSymbol(symbol: string): string {
  return getSymbolRoute(symbol).market;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isBareUSSymbol(symbol: string): boolean {
  return /^[A-Z]{1,5}$/.test(symbol);
}
