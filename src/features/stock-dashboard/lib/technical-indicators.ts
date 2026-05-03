export interface IndicatorCandle {
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export type NullableIndicatorValue = number | null;

export interface BollingerBandsPoint {
  middle: NullableIndicatorValue;
  upper: NullableIndicatorValue;
  lower: NullableIndicatorValue;
}

export interface MacdPoint {
  macd: NullableIndicatorValue;
  signal: NullableIndicatorValue;
  histogram: NullableIndicatorValue;
}

export interface IntegerParameterOptions {
  min?: number;
  max?: number;
}

export interface NumberParameterOptions extends IntegerParameterOptions {
  precision?: number;
}

export const TECHNICAL_INDICATOR_IDS = [
  'sma',
  'ema',
  'rsi',
  'macd',
  'bollinger',
  'vwap'
] as const;

export type TechnicalIndicatorId = (typeof TECHNICAL_INDICATOR_IDS)[number];

export interface PeriodIndicatorPreference {
  enabled: boolean;
  period: number;
}

export interface MacdIndicatorPreference {
  enabled: boolean;
  fastPeriod: number;
  slowPeriod: number;
  signalPeriod: number;
}

export interface BollingerBandsIndicatorPreference
  extends PeriodIndicatorPreference {
  standardDeviations: number;
}

export interface TechnicalIndicatorPreferences {
  sma: PeriodIndicatorPreference;
  ema: PeriodIndicatorPreference;
  rsi: PeriodIndicatorPreference;
  macd: MacdIndicatorPreference;
  bollinger: BollingerBandsIndicatorPreference;
  vwap: PeriodIndicatorPreference;
}

export type TechnicalIndicatorPreferencePatch = {
  [K in keyof TechnicalIndicatorPreferences]?: Partial<
    TechnicalIndicatorPreferences[K]
  >;
};

export const DEFAULT_TECHNICAL_INDICATORS: TechnicalIndicatorPreferences = {
  sma: {
    enabled: false,
    period: 20
  },
  ema: {
    enabled: false,
    period: 20
  },
  rsi: {
    enabled: false,
    period: 14
  },
  macd: {
    enabled: false,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9
  },
  bollinger: {
    enabled: false,
    period: 20,
    standardDeviations: 2
  },
  vwap: {
    enabled: false,
    period: 20
  }
};

const DEFAULT_PERIOD_LIMITS = {
  min: 1,
  max: 500
};

export function normalizeIntegerParameter(
  value: unknown,
  fallback: number,
  options: IntegerParameterOptions = {}
) {
  const min = options.min ?? DEFAULT_PERIOD_LIMITS.min;
  const max = options.max ?? DEFAULT_PERIOD_LIMITS.max;
  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

export function normalizeNumberParameter(
  value: unknown,
  fallback: number,
  options: NumberParameterOptions = {}
) {
  const min = options.min ?? 0;
  const max = options.max ?? 100;
  const precision = options.precision ?? 2;
  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  const clampedValue = Math.min(max, Math.max(min, numericValue));
  const multiplier = 10 ** precision;

  return Math.round(clampedValue * multiplier) / multiplier;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeEnabled(
  value: Record<string, unknown> | undefined,
  fallback: boolean
) {
  return typeof value?.enabled === 'boolean' ? value.enabled : fallback;
}

function normalizePeriodPreference(
  value: unknown,
  fallback: PeriodIndicatorPreference
): PeriodIndicatorPreference {
  const rawPreference = isRecord(value) ? value : undefined;

  return {
    enabled: normalizeEnabled(rawPreference, fallback.enabled),
    period: normalizeIntegerParameter(rawPreference?.period, fallback.period)
  };
}

function normalizeMacdPreference(
  value: unknown,
  fallback: MacdIndicatorPreference
): MacdIndicatorPreference {
  const rawPreference = isRecord(value) ? value : undefined;
  const fastPeriod = normalizeIntegerParameter(
    rawPreference?.fastPeriod,
    fallback.fastPeriod
  );
  const slowPeriod = normalizeIntegerParameter(
    rawPreference?.slowPeriod,
    fallback.slowPeriod
  );
  const normalizedFastPeriod = Math.max(
    1,
    Math.min(fastPeriod, slowPeriod - 1)
  );
  const normalizedSlowPeriod = Math.max(slowPeriod, normalizedFastPeriod + 1);

  return {
    enabled: normalizeEnabled(rawPreference, fallback.enabled),
    fastPeriod: normalizedFastPeriod,
    slowPeriod: normalizedSlowPeriod,
    signalPeriod: normalizeIntegerParameter(
      rawPreference?.signalPeriod,
      fallback.signalPeriod
    )
  };
}

function normalizeBollingerPreference(
  value: unknown,
  fallback: BollingerBandsIndicatorPreference
): BollingerBandsIndicatorPreference {
  const rawPreference = isRecord(value) ? value : undefined;
  const periodPreference = normalizePeriodPreference(value, fallback);

  return {
    ...periodPreference,
    standardDeviations: normalizeNumberParameter(
      rawPreference?.standardDeviations,
      fallback.standardDeviations,
      {
        min: 0.1,
        max: 10,
        precision: 2
      }
    )
  };
}

export function normalizeTechnicalIndicators(
  value: unknown
): TechnicalIndicatorPreferences {
  const rawIndicators = isRecord(value) ? value : {};

  return {
    sma: normalizePeriodPreference(
      rawIndicators.sma,
      DEFAULT_TECHNICAL_INDICATORS.sma
    ),
    ema: normalizePeriodPreference(
      rawIndicators.ema,
      DEFAULT_TECHNICAL_INDICATORS.ema
    ),
    rsi: normalizePeriodPreference(
      rawIndicators.rsi,
      DEFAULT_TECHNICAL_INDICATORS.rsi
    ),
    macd: normalizeMacdPreference(
      rawIndicators.macd,
      DEFAULT_TECHNICAL_INDICATORS.macd
    ),
    bollinger: normalizeBollingerPreference(
      rawIndicators.bollinger,
      DEFAULT_TECHNICAL_INDICATORS.bollinger
    ),
    vwap: normalizePeriodPreference(
      rawIndicators.vwap,
      DEFAULT_TECHNICAL_INDICATORS.vwap
    )
  };
}

export function mergeTechnicalIndicatorPreferences(
  current: TechnicalIndicatorPreferences,
  patch: TechnicalIndicatorPreferencePatch | undefined
) {
  if (!patch) {
    return normalizeTechnicalIndicators(current);
  }

  return normalizeTechnicalIndicators({
    sma: {
      ...current.sma,
      ...patch.sma
    },
    ema: {
      ...current.ema,
      ...patch.ema
    },
    rsi: {
      ...current.rsi,
      ...patch.rsi
    },
    macd: {
      ...current.macd,
      ...patch.macd
    },
    bollinger: {
      ...current.bollinger,
      ...patch.bollinger
    },
    vwap: {
      ...current.vwap,
      ...patch.vwap
    }
  });
}

function getClose(candle: IndicatorCandle) {
  return Number.isFinite(candle.close) ? candle.close : 0;
}

function getTypicalPrice(candle: IndicatorCandle) {
  const high = Number.isFinite(candle.high) ? candle.high : getClose(candle);
  const low = Number.isFinite(candle.low) ? candle.low : getClose(candle);

  return (high + low + getClose(candle)) / 3;
}

function calculateRsiValue(averageGain: number, averageLoss: number) {
  if (averageGain === 0 && averageLoss === 0) {
    return 50;
  }

  if (averageLoss === 0) {
    return 100;
  }

  if (averageGain === 0) {
    return 0;
  }

  const relativeStrength = averageGain / averageLoss;

  return 100 - 100 / (1 + relativeStrength);
}

function calculateNullableEma(
  values: NullableIndicatorValue[],
  period: number
) {
  const normalizedPeriod = normalizeIntegerParameter(period, 1);
  const result: NullableIndicatorValue[] = Array(values.length).fill(null);
  const multiplier = 2 / (normalizedPeriod + 1);
  let seedSum = 0;
  let seedCount = 0;
  let previousEma: NullableIndicatorValue = null;

  values.forEach((value, index) => {
    if (value === null) {
      return;
    }

    if (previousEma === null) {
      seedSum += value;
      seedCount += 1;

      if (seedCount === normalizedPeriod) {
        previousEma = seedSum / normalizedPeriod;
        result[index] = previousEma;
      }

      return;
    }

    previousEma = value * multiplier + previousEma * (1 - multiplier);
    result[index] = previousEma;
  });

  return result;
}

export function calculateSMA(
  candles: IndicatorCandle[],
  period: number
): NullableIndicatorValue[] {
  const normalizedPeriod = normalizeIntegerParameter(period, 1);
  const result: NullableIndicatorValue[] = Array(candles.length).fill(null);
  let rollingSum = 0;

  candles.forEach((candle, index) => {
    rollingSum += getClose(candle);

    if (index >= normalizedPeriod) {
      rollingSum -= getClose(candles[index - normalizedPeriod]);
    }

    if (index >= normalizedPeriod - 1) {
      result[index] = rollingSum / normalizedPeriod;
    }
  });

  return result;
}

export function calculateEMA(
  candles: IndicatorCandle[],
  period: number
): NullableIndicatorValue[] {
  const normalizedPeriod = normalizeIntegerParameter(period, 1);
  const closes = candles.map((candle) => getClose(candle));

  return calculateNullableEma(closes, normalizedPeriod);
}

export function calculateRSI(
  candles: IndicatorCandle[],
  period: number
): NullableIndicatorValue[] {
  const normalizedPeriod = normalizeIntegerParameter(period, 1);
  const result: NullableIndicatorValue[] = Array(candles.length).fill(null);
  let averageGain = 0;
  let averageLoss = 0;

  for (let index = 1; index < candles.length; index += 1) {
    const change = getClose(candles[index]) - getClose(candles[index - 1]);
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    if (index <= normalizedPeriod) {
      averageGain += gain;
      averageLoss += loss;

      if (index === normalizedPeriod) {
        averageGain /= normalizedPeriod;
        averageLoss /= normalizedPeriod;
        result[index] = calculateRsiValue(averageGain, averageLoss);
      }

      continue;
    }

    averageGain =
      (averageGain * (normalizedPeriod - 1) + gain) / normalizedPeriod;
    averageLoss =
      (averageLoss * (normalizedPeriod - 1) + loss) / normalizedPeriod;
    result[index] = calculateRsiValue(averageGain, averageLoss);
  }

  return result;
}

export function calculateMACD(
  candles: IndicatorCandle[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): MacdPoint[] {
  const normalizedFastPeriod = normalizeIntegerParameter(fastPeriod, 12);
  const normalizedSlowPeriod = Math.max(
    normalizeIntegerParameter(slowPeriod, 26),
    normalizedFastPeriod + 1
  );
  const normalizedSignalPeriod = normalizeIntegerParameter(signalPeriod, 9);
  const fastEma = calculateEMA(candles, normalizedFastPeriod);
  const slowEma = calculateEMA(candles, normalizedSlowPeriod);
  const macd = fastEma.map((fastValue, index) => {
    const slowValue = slowEma[index];

    if (fastValue === null || slowValue === null) {
      return null;
    }

    return fastValue - slowValue;
  });
  const signal = calculateNullableEma(macd, normalizedSignalPeriod);

  return macd.map((macdValue, index) => {
    const signalValue = signal[index];

    return {
      macd: macdValue,
      signal: signalValue,
      histogram:
        macdValue === null || signalValue === null
          ? null
          : macdValue - signalValue
    };
  });
}

export function calculateBollingerBands(
  candles: IndicatorCandle[],
  period: number,
  standardDeviations: number
): BollingerBandsPoint[] {
  const normalizedPeriod = normalizeIntegerParameter(period, 20);
  const normalizedStandardDeviations = normalizeNumberParameter(
    standardDeviations,
    2,
    {
      min: 0.1,
      max: 10,
      precision: 2
    }
  );
  let rollingSum = 0;
  let rollingSquaredSum = 0;

  return candles.map((candle, index) => {
    const close = getClose(candle);
    rollingSum += close;
    rollingSquaredSum += close * close;

    if (index >= normalizedPeriod) {
      const removedClose = getClose(candles[index - normalizedPeriod]);
      rollingSum -= removedClose;
      rollingSquaredSum -= removedClose * removedClose;
    }

    if (index < normalizedPeriod - 1) {
      return {
        middle: null,
        upper: null,
        lower: null
      };
    }

    const middle = rollingSum / normalizedPeriod;
    const variance = Math.max(
      rollingSquaredSum / normalizedPeriod - middle * middle,
      0
    );
    const standardDeviation = Math.sqrt(variance);
    const bandWidth = normalizedStandardDeviations * standardDeviation;

    return {
      middle,
      upper: middle + bandWidth,
      lower: middle - bandWidth
    };
  });
}

export function calculateVWAP(
  candles: IndicatorCandle[],
  period: number
): NullableIndicatorValue[] {
  const normalizedPeriod = normalizeIntegerParameter(period, 1);
  const result: NullableIndicatorValue[] = Array(candles.length).fill(null);
  let rollingPriceVolume = 0;
  let rollingVolume = 0;

  candles.forEach((candle, index) => {
    const volume = Math.max(Number(candle.volume ?? 0), 0);
    const priceVolume = getTypicalPrice(candle) * volume;
    rollingPriceVolume += priceVolume;
    rollingVolume += volume;

    if (index >= normalizedPeriod) {
      const removedCandle = candles[index - normalizedPeriod];
      const removedVolume = Math.max(Number(removedCandle.volume ?? 0), 0);
      rollingPriceVolume -= getTypicalPrice(removedCandle) * removedVolume;
      rollingVolume -= removedVolume;
    }

    if (index >= normalizedPeriod - 1 && rollingVolume > 0) {
      result[index] = rollingPriceVolume / rollingVolume;
    }
  });

  return result;
}
