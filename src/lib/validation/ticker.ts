export function isValidTicker(symbol: string): boolean {
  if (!symbol) return false;
  const normalized = symbol.trim().toUpperCase();
  return /^[A-Z]{1,5}$/.test(normalized);
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
  if (trimmed.length === 0) {
    return { isValid: false, error: 'Ticker symbol is required' };
  }

  if (trimmed.length > 5) {
    return {
      isValid: false,
      error: 'Ticker symbol must be 5 characters or less'
    };
  }

  if (!/^[A-Za-z]+$/.test(trimmed)) {
    return { isValid: false, error: 'Ticker symbol must contain only letters' };
  }

  return { isValid: true };
}
