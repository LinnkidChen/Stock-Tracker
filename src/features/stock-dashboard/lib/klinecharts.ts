import type { Chart, IndicatorTemplate, KLineData } from 'klinecharts';
import type { KLineInterval } from '@/lib/types/stock-api';
import {
  DEFAULT_CHART_WORKSPACE,
  type ChartPreferences
} from './chart-workspace';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateVWAP,
  normalizeTechnicalIndicators,
  type TechnicalIndicatorPreferences
} from './technical-indicators';

export interface KLineChartHandle {
  update: (
    symbol: string,
    data: KLineData[],
    interval: KLineInterval,
    preferences?: ChartPreferences
  ) => void;
  destroy: () => void;
}

export interface CreateKLineChartOptions {
  symbol: string;
  interval: KLineInterval;
  data?: KLineData[];
  preferences?: ChartPreferences;
}

let klineModule: typeof import('klinecharts') | null = null;
let technicalIndicatorsRegistered = false;

const CANDLE_PANE_ID = 'candle_pane';
const VOLUME_PANE_ID = 'volume-pane';

const TECHNICAL_INDICATOR_NAMES = {
  sma: 'STOCK_TRACKER_SMA',
  ema: 'STOCK_TRACKER_EMA',
  rsi: 'STOCK_TRACKER_RSI',
  macd: 'STOCK_TRACKER_MACD',
  bollinger: 'STOCK_TRACKER_BOLLINGER',
  vwap: 'STOCK_TRACKER_VWAP'
} as const;

const TECHNICAL_INDICATOR_PANES = {
  rsi: 'rsi-pane',
  macd: 'macd-pane'
} as const;

type IndicatorResult = Record<string, number>;

function mapSingleValueResult(
  values: Array<number | null>,
  key: string
): IndicatorResult[] {
  return values.map((value) => (value === null ? {} : { [key]: value }));
}

function createLineStyles(colors: string[]) {
  return {
    lines: colors.map((color) => ({
      style: 'solid' as const,
      smooth: false,
      size: 1,
      dashedValue: [2, 2],
      color
    }))
  };
}

function registerTechnicalIndicatorTemplates(
  registerIndicator: (typeof import('klinecharts'))['registerIndicator']
) {
  if (technicalIndicatorsRegistered) {
    return;
  }

  const smaIndicator: IndicatorTemplate<IndicatorResult, number> = {
    name: TECHNICAL_INDICATOR_NAMES.sma,
    shortName: 'SMA',
    series: 'price',
    calcParams: [DEFAULT_CHART_WORKSPACE.preferences.indicators.sma.period],
    precision: 2,
    shouldOhlc: true,
    figures: [{ key: 'sma', title: 'SMA: ', type: 'line' }],
    styles: createLineStyles(['#2563eb']),
    regenerateFigures: ([period]) => [
      { key: 'sma', title: `SMA${period}: `, type: 'line' }
    ],
    calc: (dataList, indicator) =>
      mapSingleValueResult(
        calculateSMA(dataList, indicator.calcParams[0]),
        'sma'
      )
  };

  const emaIndicator: IndicatorTemplate<IndicatorResult, number> = {
    name: TECHNICAL_INDICATOR_NAMES.ema,
    shortName: 'EMA',
    series: 'price',
    calcParams: [DEFAULT_CHART_WORKSPACE.preferences.indicators.ema.period],
    precision: 2,
    shouldOhlc: true,
    figures: [{ key: 'ema', title: 'EMA: ', type: 'line' }],
    styles: createLineStyles(['#ea580c']),
    regenerateFigures: ([period]) => [
      { key: 'ema', title: `EMA${period}: `, type: 'line' }
    ],
    calc: (dataList, indicator) =>
      mapSingleValueResult(
        calculateEMA(dataList, indicator.calcParams[0]),
        'ema'
      )
  };

  const rsiIndicator: IndicatorTemplate<IndicatorResult, number> = {
    name: TECHNICAL_INDICATOR_NAMES.rsi,
    shortName: 'RSI',
    calcParams: [DEFAULT_CHART_WORKSPACE.preferences.indicators.rsi.period],
    precision: 2,
    minValue: 0,
    maxValue: 100,
    figures: [{ key: 'rsi', title: 'RSI: ', type: 'line' }],
    styles: createLineStyles(['#7c3aed']),
    regenerateFigures: ([period]) => [
      { key: 'rsi', title: `RSI${period}: `, type: 'line' }
    ],
    calc: (dataList, indicator) =>
      mapSingleValueResult(
        calculateRSI(dataList, indicator.calcParams[0]),
        'rsi'
      )
  };

  const macdIndicator: IndicatorTemplate<IndicatorResult, number> = {
    name: TECHNICAL_INDICATOR_NAMES.macd,
    shortName: 'MACD',
    calcParams: [
      DEFAULT_CHART_WORKSPACE.preferences.indicators.macd.fastPeriod,
      DEFAULT_CHART_WORKSPACE.preferences.indicators.macd.slowPeriod,
      DEFAULT_CHART_WORKSPACE.preferences.indicators.macd.signalPeriod
    ],
    precision: 4,
    figures: [
      { key: 'macd', title: 'MACD: ', type: 'line' },
      { key: 'signal', title: 'Signal: ', type: 'line' },
      {
        key: 'histogram',
        title: 'Hist: ',
        type: 'bar',
        baseValue: 0,
        styles: ({ data }) => {
          const histogram = data.current?.histogram ?? 0;
          const color = histogram >= 0 ? '#16a34a' : '#dc2626';

          return {
            style: 'fill',
            color,
            borderColor: color
          };
        }
      }
    ],
    styles: createLineStyles(['#0f766e', '#be123c']),
    calc: (dataList, indicator) =>
      calculateMACD(
        dataList,
        indicator.calcParams[0],
        indicator.calcParams[1],
        indicator.calcParams[2]
      ).map((point) => ({
        ...(point.macd === null ? {} : { macd: point.macd }),
        ...(point.signal === null ? {} : { signal: point.signal }),
        ...(point.histogram === null ? {} : { histogram: point.histogram })
      }))
  };

  const bollingerIndicator: IndicatorTemplate<IndicatorResult, number> = {
    name: TECHNICAL_INDICATOR_NAMES.bollinger,
    shortName: 'BB',
    series: 'price',
    calcParams: [
      DEFAULT_CHART_WORKSPACE.preferences.indicators.bollinger.period,
      DEFAULT_CHART_WORKSPACE.preferences.indicators.bollinger
        .standardDeviations
    ],
    precision: 2,
    shouldOhlc: true,
    figures: [
      { key: 'upper', title: 'Upper: ', type: 'line' },
      { key: 'middle', title: 'Middle: ', type: 'line' },
      { key: 'lower', title: 'Lower: ', type: 'line' }
    ],
    styles: createLineStyles(['#0891b2', '#64748b', '#0891b2']),
    regenerateFigures: ([period, standardDeviations]) => [
      {
        key: 'upper',
        title: `BB${period}/${standardDeviations} Upper: `,
        type: 'line'
      },
      { key: 'middle', title: 'Middle: ', type: 'line' },
      { key: 'lower', title: 'Lower: ', type: 'line' }
    ],
    calc: (dataList, indicator) =>
      calculateBollingerBands(
        dataList,
        indicator.calcParams[0],
        indicator.calcParams[1]
      ).map((point) => ({
        ...(point.upper === null ? {} : { upper: point.upper }),
        ...(point.middle === null ? {} : { middle: point.middle }),
        ...(point.lower === null ? {} : { lower: point.lower })
      }))
  };

  const vwapIndicator: IndicatorTemplate<IndicatorResult, number> = {
    name: TECHNICAL_INDICATOR_NAMES.vwap,
    shortName: 'VWAP',
    series: 'price',
    calcParams: [DEFAULT_CHART_WORKSPACE.preferences.indicators.vwap.period],
    precision: 2,
    shouldOhlc: true,
    figures: [{ key: 'vwap', title: 'VWAP: ', type: 'line' }],
    styles: createLineStyles(['#ca8a04']),
    regenerateFigures: ([period]) => [
      { key: 'vwap', title: `VWAP${period}: `, type: 'line' }
    ],
    calc: (dataList, indicator) =>
      mapSingleValueResult(
        calculateVWAP(dataList, indicator.calcParams[0]),
        'vwap'
      )
  };

  [
    smaIndicator,
    emaIndicator,
    rsiIndicator,
    macdIndicator,
    bollingerIndicator,
    vwapIndicator
  ].forEach((indicator) => registerIndicator(indicator));

  technicalIndicatorsRegistered = true;
}

async function getKLineModule() {
  if (!klineModule) {
    klineModule = await import('klinecharts');
    registerTechnicalIndicatorTemplates(klineModule.registerIndicator);
  }
  return klineModule;
}

function applyData(
  chart: Chart,
  symbol: string,
  data: KLineData[],
  interval: KLineInterval
) {
  chart.setSymbol({
    ticker: symbol,
    pricePrecision: 2,
    volumePrecision: 0
  });
  chart.setPeriod({ type: interval, span: 1 });
  chart.setDataLoader({
    getBars: ({ callback }) => {
      callback(data, false);
    }
  });
  chart.resetData();
}

function applyPreferences(chart: Chart, preferences: ChartPreferences) {
  const technicalIndicators = normalizeTechnicalIndicators(
    preferences.indicators
  );

  chart.setStyles({
    grid: {
      show: preferences.showGrid,
      horizontal: {
        show: preferences.showGrid
      },
      vertical: {
        show: preferences.showGrid
      }
    },
    candle: {
      type: preferences.candleType
    }
  });

  const volumeIndicators = chart.getIndicators({ name: 'VOL' });

  if (preferences.showVolume && volumeIndicators.length === 0) {
    chart.createIndicator('VOL', false, {
      id: VOLUME_PANE_ID,
      height: 120,
      minHeight: 80
    });
  }

  if (!preferences.showVolume && volumeIndicators.length > 0) {
    chart.removeIndicator({ name: 'VOL' });
  }

  applyTechnicalIndicators(chart, technicalIndicators);
}

function syncTechnicalIndicator(
  chart: Chart,
  options: {
    enabled: boolean;
    id: string;
    name: string;
    calcParams: number[];
    paneId: string;
    height?: number;
  }
) {
  const existingIndicators = chart.getIndicators({ id: options.id });

  if (!options.enabled) {
    if (existingIndicators.length > 0) {
      chart.removeIndicator({ id: options.id });
    }
    return;
  }

  const indicator = {
    id: options.id,
    name: options.name,
    calcParams: options.calcParams
  };

  if (existingIndicators.length === 0) {
    chart.createIndicator(indicator, true, {
      id: options.paneId,
      height: options.height,
      minHeight: options.height ? 90 : undefined
    });
    return;
  }

  chart.overrideIndicator(indicator);
}

function applyTechnicalIndicators(
  chart: Chart,
  indicators: TechnicalIndicatorPreferences
) {
  syncTechnicalIndicator(chart, {
    enabled: indicators.sma.enabled,
    id: TECHNICAL_INDICATOR_NAMES.sma,
    name: TECHNICAL_INDICATOR_NAMES.sma,
    calcParams: [indicators.sma.period],
    paneId: CANDLE_PANE_ID
  });

  syncTechnicalIndicator(chart, {
    enabled: indicators.ema.enabled,
    id: TECHNICAL_INDICATOR_NAMES.ema,
    name: TECHNICAL_INDICATOR_NAMES.ema,
    calcParams: [indicators.ema.period],
    paneId: CANDLE_PANE_ID
  });

  syncTechnicalIndicator(chart, {
    enabled: indicators.bollinger.enabled,
    id: TECHNICAL_INDICATOR_NAMES.bollinger,
    name: TECHNICAL_INDICATOR_NAMES.bollinger,
    calcParams: [
      indicators.bollinger.period,
      indicators.bollinger.standardDeviations
    ],
    paneId: CANDLE_PANE_ID
  });

  syncTechnicalIndicator(chart, {
    enabled: indicators.vwap.enabled,
    id: TECHNICAL_INDICATOR_NAMES.vwap,
    name: TECHNICAL_INDICATOR_NAMES.vwap,
    calcParams: [indicators.vwap.period],
    paneId: CANDLE_PANE_ID
  });

  syncTechnicalIndicator(chart, {
    enabled: indicators.rsi.enabled,
    id: TECHNICAL_INDICATOR_NAMES.rsi,
    name: TECHNICAL_INDICATOR_NAMES.rsi,
    calcParams: [indicators.rsi.period],
    paneId: TECHNICAL_INDICATOR_PANES.rsi,
    height: 120
  });

  syncTechnicalIndicator(chart, {
    enabled: indicators.macd.enabled,
    id: TECHNICAL_INDICATOR_NAMES.macd,
    name: TECHNICAL_INDICATOR_NAMES.macd,
    calcParams: [
      indicators.macd.fastPeriod,
      indicators.macd.slowPeriod,
      indicators.macd.signalPeriod
    ],
    paneId: TECHNICAL_INDICATOR_PANES.macd,
    height: 140
  });
}

function updateChart(
  chart: Chart,
  symbol: string,
  data: KLineData[],
  interval: KLineInterval,
  preferences: ChartPreferences
) {
  applyPreferences(chart, preferences);
  applyData(chart, symbol, data, interval);
}

export async function createKLineChart(
  container: HTMLElement,
  options: CreateKLineChartOptions
): Promise<KLineChartHandle> {
  const { init, dispose } = await getKLineModule();
  const chart = init(container);

  if (!chart) {
    throw new Error('Failed to initialize kline chart');
  }

  updateChart(
    chart,
    options.symbol,
    options.data ?? [],
    options.interval,
    options.preferences ?? DEFAULT_CHART_WORKSPACE.preferences
  );

  const resizeObserver = new ResizeObserver(() => {
    chart.resize();
  });

  resizeObserver.observe(container);

  return {
    update: (
      symbol,
      data,
      interval,
      preferences = options.preferences ?? DEFAULT_CHART_WORKSPACE.preferences
    ) => updateChart(chart, symbol, data, interval, preferences),
    destroy: () => {
      resizeObserver.disconnect();
      dispose(chart);
    }
  };
}
