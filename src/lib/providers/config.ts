import type { ProviderId } from './types';

export const AUTO_QUOTE_PROVIDER = 'auto' as const;
export const LONGBRIDGE_QUOTE_PROVIDER = 'longbridge' as const;
export const YAHOO_QUOTE_PROVIDER = 'yahoo' as const;
export const CANONICAL_QUOTE_PROVIDER = AUTO_QUOTE_PROVIDER;
export const LEGACY_DEFAULT_QUOTE_PROVIDER = 'default' as const;

export type CanonicalQuoteProvider = ProviderId;

export const QUOTE_PROVIDER_OPTIONS = [
  {
    value: AUTO_QUOTE_PROVIDER,
    label: 'Auto'
  },
  {
    value: LONGBRIDGE_QUOTE_PROVIDER,
    label: 'Longbridge'
  },
  {
    value: YAHOO_QUOTE_PROVIDER,
    label: 'Yahoo Finance'
  }
] as const;

function normalizeProviderValue(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function resolveQuoteProvider(value?: string | null): ProviderId | null {
  const normalized = normalizeProviderValue(value);

  if (!normalized) {
    return CANONICAL_QUOTE_PROVIDER;
  }

  if (normalized === LEGACY_DEFAULT_QUOTE_PROVIDER) {
    return CANONICAL_QUOTE_PROVIDER;
  }

  const provider = QUOTE_PROVIDER_OPTIONS.find(
    (option) => option.value === normalized
  );

  return provider?.value ?? null;
}

export function migrateStoredQuoteProvider(value?: string | null): ProviderId {
  return resolveQuoteProvider(value) ?? CANONICAL_QUOTE_PROVIDER;
}
