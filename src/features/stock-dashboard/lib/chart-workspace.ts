import {
  DEFAULT_KLINE_INTERVAL,
  isKLineInterval,
  type KLineCandle,
  type KLineInterval
} from '@/lib/types/stock-api';
import {
  DEFAULT_TECHNICAL_INDICATORS,
  mergeTechnicalIndicatorPreferences,
  normalizeTechnicalIndicators,
  type TechnicalIndicatorPreferencePatch,
  type TechnicalIndicatorPreferences
} from './technical-indicators';

export const CHART_WORKSPACE_STORAGE_KEY = 'dashboard:chartWorkspace:v1';

export const CHART_RANGES = ['1m', '3m', '6m', '1y', 'max'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

export const CHART_CANDLE_TYPES = ['candle_solid', 'ohlc', 'area'] as const;
export type ChartCandleType = (typeof CHART_CANDLE_TYPES)[number];

export interface ChartPreferences {
  showVolume: boolean;
  showGrid: boolean;
  candleType: ChartCandleType;
  indicators: TechnicalIndicatorPreferences;
}

export type ChartPreferencesPatch = Partial<
  Omit<ChartPreferences, 'indicators'>
> & {
  indicators?: TechnicalIndicatorPreferencePatch;
};

export interface ChartWorkspace {
  symbol: string | null;
  interval: KLineInterval;
  range: ChartRange;
  preferences: ChartPreferences;
}

export type ChartWorkspacePatch = Partial<
  Pick<ChartWorkspace, 'symbol' | 'interval' | 'range'>
>;

export const DEFAULT_CHART_WORKSPACE: ChartWorkspace = {
  symbol: null,
  interval: DEFAULT_KLINE_INTERVAL,
  range: '1y',
  preferences: {
    showVolume: true,
    showGrid: true,
    candleType: 'candle_solid',
    indicators: DEFAULT_TECHNICAL_INDICATORS
  }
};

export function isChartRange(
  value: string | null | undefined
): value is ChartRange {
  return CHART_RANGES.includes(value as ChartRange);
}

export function isChartCandleType(
  value: string | null | undefined
): value is ChartCandleType {
  return CHART_CANDLE_TYPES.includes(value as ChartCandleType);
}

export function normalizeChartPreferences(
  preferences:
    | (Partial<Omit<ChartPreferences, 'indicators'>> & {
        indicators?: unknown;
      })
    | null
    | undefined
): ChartPreferences {
  return {
    showVolume:
      typeof preferences?.showVolume === 'boolean'
        ? preferences.showVolume
        : DEFAULT_CHART_WORKSPACE.preferences.showVolume,
    showGrid:
      typeof preferences?.showGrid === 'boolean'
        ? preferences.showGrid
        : DEFAULT_CHART_WORKSPACE.preferences.showGrid,
    candleType: isChartCandleType(preferences?.candleType)
      ? preferences.candleType
      : DEFAULT_CHART_WORKSPACE.preferences.candleType,
    indicators: normalizeTechnicalIndicators(preferences?.indicators)
  };
}

export function mergeChartPreferences(
  current: ChartPreferences,
  patch: ChartPreferencesPatch
): ChartPreferences {
  return normalizeChartPreferences({
    ...current,
    ...patch,
    indicators: mergeTechnicalIndicatorPreferences(
      current.indicators,
      patch.indicators
    )
  });
}

export function parseChartWorkspace(raw: string | null): ChartWorkspace {
  if (!raw) {
    return DEFAULT_CHART_WORKSPACE;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ChartWorkspace>;

    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_CHART_WORKSPACE;
    }

    const preferences = parsed.preferences;

    return {
      symbol:
        typeof parsed.symbol === 'string' && parsed.symbol.trim()
          ? parsed.symbol.trim().toUpperCase()
          : DEFAULT_CHART_WORKSPACE.symbol,
      interval: isKLineInterval(parsed.interval)
        ? parsed.interval
        : DEFAULT_CHART_WORKSPACE.interval,
      range: isChartRange(parsed.range)
        ? parsed.range
        : DEFAULT_CHART_WORKSPACE.range,
      preferences: normalizeChartPreferences(preferences)
    };
  } catch {
    return DEFAULT_CHART_WORKSPACE;
  }
}

export function filterCandlesByRange(
  candles: KLineCandle[],
  range: ChartRange
): KLineCandle[] {
  if (range === 'max' || candles.length === 0) {
    return candles;
  }

  const endTimestamp = candles.reduce(
    (latest, candle) => Math.max(latest, candle.timestamp),
    candles[0].timestamp
  );
  const startDate = new Date(endTimestamp);

  if (range === '1y') {
    startDate.setFullYear(startDate.getFullYear() - 1);
  } else {
    const months = range === '1m' ? 1 : range === '3m' ? 3 : 6;
    startDate.setMonth(startDate.getMonth() - months);
  }

  const filtered = candles.filter(
    (candle) => candle.timestamp >= startDate.getTime()
  );

  return filtered.length > 0 ? filtered : [candles[candles.length - 1]];
}

export function buildChartsHref(
  searchParams: URLSearchParams,
  workspacePatch: ChartWorkspacePatch
) {
  const nextSearchParams = new URLSearchParams(searchParams.toString());

  if ('symbol' in workspacePatch) {
    if (workspacePatch.symbol) {
      nextSearchParams.set('symbol', workspacePatch.symbol);
    } else {
      nextSearchParams.delete('symbol');
    }
  }

  if ('interval' in workspacePatch) {
    if (workspacePatch.interval) {
      nextSearchParams.set('interval', workspacePatch.interval);
    } else {
      nextSearchParams.delete('interval');
    }
  }

  if ('range' in workspacePatch) {
    if (workspacePatch.range) {
      nextSearchParams.set('range', workspacePatch.range);
    } else {
      nextSearchParams.delete('range');
    }
  }

  const query = nextSearchParams.toString();
  return query ? `/dashboard/charts?${query}` : '/dashboard/charts';
}
