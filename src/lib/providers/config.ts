export const CANONICAL_QUOTE_PROVIDER = 'longbridge' as const;
export const LEGACY_DEFAULT_QUOTE_PROVIDER = 'default' as const;

export type CanonicalQuoteProvider = typeof CANONICAL_QUOTE_PROVIDER;

export const QUOTE_PROVIDER_OPTIONS = [
  {
    value: CANONICAL_QUOTE_PROVIDER,
    label: 'Longbridge'
  }
] as const;

function normalizeProviderValue(value?: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export function resolveQuoteProvider(
  value?: string | null
): CanonicalQuoteProvider | null {
  const normalized = normalizeProviderValue(value);

  if (!normalized) {
    return CANONICAL_QUOTE_PROVIDER;
  }

  if (
    normalized === CANONICAL_QUOTE_PROVIDER ||
    normalized === LEGACY_DEFAULT_QUOTE_PROVIDER
  ) {
    return CANONICAL_QUOTE_PROVIDER;
  }

  return null;
}

export function migrateStoredQuoteProvider(
  value?: string | null
): CanonicalQuoteProvider {
  return resolveQuoteProvider(value) ?? CANONICAL_QUOTE_PROVIDER;
}
