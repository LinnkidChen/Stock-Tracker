import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateVWAP,
  normalizeTechnicalIndicators,
  type IndicatorCandle
} from './technical-indicators';

function buildCandles(closes: number[]): IndicatorCandle[] {
  return closes.map((close) => ({
    high: close,
    low: close,
    close,
    volume: 100
  }));
}

describe('technical indicators', () => {
  it('calculates simple moving averages with null warm-up values', () => {
    expect(calculateSMA(buildCandles([1, 2, 3, 4, 5]), 3)).toEqual([
      null,
      null,
      2,
      3,
      4
    ]);
  });

  it('calculates exponential moving averages seeded from the first window', () => {
    expect(calculateEMA(buildCandles([1, 2, 3, 4, 5]), 3)).toEqual([
      null,
      null,
      2,
      3,
      4
    ]);
  });

  it('calculates Wilder RSI values from close-to-close gains and losses', () => {
    expect(calculateRSI(buildCandles([1, 2, 3, 2, 1]), 2)).toEqual([
      null,
      null,
      100,
      50,
      25
    ]);
  });

  it('calculates MACD line, signal line, and histogram', () => {
    const macd = calculateMACD(buildCandles([1, 2, 4, 8, 16]), 2, 3, 2);

    expect(macd[0]).toEqual({
      macd: null,
      signal: null,
      histogram: null
    });
    expect(macd[2].macd).toBeCloseTo(0.8333, 4);
    expect(macd[3].signal).toBeCloseTo(1.0278, 4);
    expect(macd[4].histogram).toBeCloseTo(0.3951, 4);
  });

  it('calculates Bollinger Bands from the rolling close variance', () => {
    const bands = calculateBollingerBands(buildCandles([1, 2, 3]), 3, 2);

    expect(bands[0]).toEqual({
      middle: null,
      upper: null,
      lower: null
    });
    expect(bands[2].middle).toBeCloseTo(2);
    expect(bands[2].upper).toBeCloseTo(3.633, 3);
    expect(bands[2].lower).toBeCloseTo(0.367, 3);
  });

  it('calculates rolling volume weighted average price', () => {
    const vwap = calculateVWAP(
      [
        { high: 2, low: 0, close: 1, volume: 10 },
        { high: 3, low: 1, close: 2, volume: 30 },
        { high: 6, low: 3, close: 3, volume: 20 }
      ],
      2
    );

    expect(vwap[0]).toBeNull();
    expect(vwap[1]).toBeCloseTo(1.75);
    expect(vwap[2]).toBeCloseTo(2.8);
  });

  it('normalizes indicator preferences and clamps invalid parameters', () => {
    expect(
      normalizeTechnicalIndicators({
        sma: { enabled: true, period: '30' },
        ema: { enabled: 'yes', period: -5 },
        macd: {
          enabled: true,
          fastPeriod: 20,
          slowPeriod: 10,
          signalPeriod: 'x'
        },
        bollinger: {
          enabled: true,
          period: 20,
          standardDeviations: 50
        }
      })
    ).toMatchObject({
      sma: { enabled: true, period: 30 },
      ema: { enabled: false, period: 1 },
      macd: {
        enabled: true,
        fastPeriod: 9,
        slowPeriod: 10,
        signalPeriod: 9
      },
      bollinger: {
        enabled: true,
        period: 20,
        standardDeviations: 10
      }
    });
  });
});
