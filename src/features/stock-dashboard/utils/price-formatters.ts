export interface PriceFormatOptions {
  precision?: number;
  currency?: string;
  locale?: string;
  showCurrency?: boolean;
}

export interface ChangeFormatOptions {
  precision?: number;
  showSign?: boolean;
  locale?: string;
}

/**
 * Formats price values with customizable precision and currency display
 */
export function formatPrice(
  value: number,
  options: PriceFormatOptions = {}
): string {
  const {
    precision = 2,
    currency = 'USD',
    locale = 'en-US',
    showCurrency = true
  } = options;

  if (isNaN(value) || !isFinite(value)) {
    return showCurrency ? '$--' : '--';
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    ...(showCurrency && {
      style: 'currency',
      currency: currency
    })
  });

  return formatter.format(value);
}

/**
 * Formats change values with proper +/- signs
 */
export function formatChange(
  value: number,
  options: ChangeFormatOptions = {}
): string {
  const { precision = 2, showSign = true, locale = 'en-US' } = options;

  if (isNaN(value) || !isFinite(value)) {
    return '--';
  }

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    signDisplay: showSign ? 'always' : 'auto'
  });

  return formatter.format(value);
}

/**
 * Formats percentage values with % suffix
 */
export function formatPercentage(
  value: number,
  options: ChangeFormatOptions = {}
): string {
  const { precision = 2, showSign = true, locale = 'en-US' } = options;

  if (isNaN(value) || !isFinite(value)) {
    return '--%';
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
    signDisplay: showSign ? 'always' : 'auto'
  });

  // Convert decimal to percentage (e.g., 0.05 -> 5%)
  return formatter.format(value / 100);
}

/**
 * Formats a complete price change display with both absolute and percentage
 */
export function formatPriceChange(
  change: number,
  changePercent: number,
  options: ChangeFormatOptions = {}
): string {
  const formattedChange = formatChange(change, options);
  const formattedPercent = formatPercentage(changePercent, options);

  return `${formattedChange} (${formattedPercent})`;
}

/**
 * Formats large numbers with appropriate suffixes (K, M, B, T)
 */
export function formatCompactNumber(
  value: number,
  precision: number = 1
): string {
  if (isNaN(value) || !isFinite(value)) {
    return '--';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1e12) {
    return `${sign}${(absValue / 1e12).toFixed(precision)}T`;
  } else if (absValue >= 1e9) {
    return `${sign}${(absValue / 1e9).toFixed(precision)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${(absValue / 1e6).toFixed(precision)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${(absValue / 1e3).toFixed(precision)}K`;
  }

  return `${sign}${absValue.toFixed(precision)}`;
}

/**
 * Determines the appropriate precision based on price value
 */
export function getAdaptivePrecision(price: number): number {
  if (isNaN(price) || !isFinite(price)) {
    return 2;
  }

  const absPrice = Math.abs(price);

  if (absPrice >= 1000) {
    return 0; // $1,234
  } else if (absPrice >= 100) {
    return 1; // $123.4
  } else if (absPrice >= 1) {
    return 2; // $12.34
  } else if (absPrice >= 0.01) {
    return 3; // $0.123
  } else {
    return 4; // $0.1234
  }
}

/**
 * Formats price with adaptive precision based on value
 */
export function formatAdaptivePrice(
  value: number,
  options: Omit<PriceFormatOptions, 'precision'> = {}
): string {
  const precision = getAdaptivePrecision(value);
  return formatPrice(value, { ...options, precision });
}
