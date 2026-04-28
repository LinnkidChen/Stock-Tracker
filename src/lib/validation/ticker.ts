const BARE_TICKER_PATTERN = /^[A-Z]{1,5}$/;
const QUALIFIED_TICKER_PATTERN = /^[A-Z0-9]{1,6}\.(US|HK|SS|SZ|CN)$/;

export function isValidTicker(symbol: string): boolean {
  if (!symbol) return false;
  const normalized = symbol.trim().toUpperCase();
  return (
    BARE_TICKER_PATTERN.test(normalized) ||
    QUALIFIED_TICKER_PATTERN.test(normalized)
  );
}

export function normalizeTicker(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function validateTicker(symbol: string): {
  isValid: boolean;
  error?: string;
} {
  if (!symbol) {
    return { isValid: false, error: 'Ticker symbol is required' };
  }

  const trimmed = symbol.trim();
  const normalized = trimmed.toUpperCase();
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Ticker symbol is required' };
  }

  if (isValidTicker(normalized)) {
    return { isValid: true };
  }

  if (!/^[A-Za-z0-9.]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Ticker symbol must contain only letters, numbers, or one dot'
    };
  }

  if ((trimmed.match(/\./g) ?? []).length > 1) {
    return {
      isValid: false,
      error: 'Ticker symbol must include at most one market suffix'
    };
  }

  if (trimmed.includes('.')) {
    return {
      isValid: false,
      error: 'Market-qualified symbols must look like AAPL.US or 0700.HK'
    };
  }

  return {
    isValid: false,
    error: 'Ticker symbol must be 1-5 letters'
  };
}
