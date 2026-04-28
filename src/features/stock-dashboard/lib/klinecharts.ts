import type { Chart, IndicatorTemplate, KLineData } from 'klinecharts';
import type { KLineInterval } from '@/lib/types/stock-api';
import {
  DEFAULT_CHART_WORKSPACE,
  type ChartIndicatorName,
  type ChartPreferences
} from './chart-workspace';

const CANDLE_PANE_ID = 'candle_pane';
const VOLUME_PANE_ID = 'volume-pane';
const VWAP_PERIOD = 20;

const PRICE_INDICATOR_PARAMS: Partial<
  Record<ChartIndicatorName, Array<number>>
> = {
  MA: [5, 10, 30, 60],
  EMA: [6, 12, 20],
  VWAP: [VWAP_PERIOD],
  BOLL: [20, 2]
};

const LOWER_INDICATOR_PANES: Partial<Record<ChartIndicatorName, string>> = {
  RSI: 'rsi-pane',
  MACD: 'macd-pane'
};

const LOWER_INDICATOR_PARAMS: Partial<
  Record<ChartIndicatorName, Array<number>>
> = {
  RSI: [6, 12, 24],
  MACD: [12, 26, 9]
};

let vwapRegistered = false;

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

async function getKLineModule() {
  if (!klineModule) {
    klineModule = await import('klinecharts');
  }
  return klineModule;
}

export function createVwapIndicatorTemplate(): IndicatorTemplate<
  { vwap?: number },
  number
> {
  return {
    name: 'VWAP',
    shortName: 'VWAP',
    series: 'price',
    calcParams: [VWAP_PERIOD],
    precision: 2,
    shouldOhlc: true,
    figures: [{ key: 'vwap', title: 'VWAP20: ', type: 'line' }],
    regenerateFigures: (params) => [
      {
        key: 'vwap',
        title: `VWAP${params[0] ?? VWAP_PERIOD}: `,
        type: 'line'
      }
    ],
    calc: (dataList, indicator) => {
      const period = indicator.calcParams[0] ?? VWAP_PERIOD;
      let priceVolumeSum = 0;
      let volumeSum = 0;

      return dataList.map((candle, index) => {
        const volume = candle.volume ?? 0;
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;

        priceVolumeSum += typicalPrice * volume;
        volumeSum += volume;

        if (index >= period) {
          const expiredCandle = dataList[index - period];
          const expiredVolume = expiredCandle.volume ?? 0;
          const expiredTypicalPrice =
            (expiredCandle.high + expiredCandle.low + expiredCandle.close) / 3;

          priceVolumeSum -= expiredTypicalPrice * expiredVolume;
          volumeSum -= expiredVolume;
        }

        if (index < period - 1 || volumeSum === 0) {
          return {};
        }

        return {
          vwap: priceVolumeSum / volumeSum
        };
      });
    }
  };
}

function registerVwapIndicator(klinechartsModule: typeof import('klinecharts')) {
  if (vwapRegistered) {
    return;
  }

  if (!klinechartsModule.getSupportedIndicators().includes('VWAP')) {
    klinechartsModule.registerIndicator(createVwapIndicatorTemplate());
  }

  vwapRegistered = true;
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

  applyChartIndicators(chart, preferences);
}

function applyChartIndicators(chart: Chart, preferences: ChartPreferences) {
  Object.entries(PRICE_INDICATOR_PARAMS).forEach(([name, calcParams]) => {
    applyIndicator(chart, name as ChartIndicatorName, {
      calcParams,
      enabled: preferences.indicators[name as ChartIndicatorName],
      isStack: true,
      paneOptions: { id: CANDLE_PANE_ID }
    });
  });

  Object.entries(LOWER_INDICATOR_PANES).forEach(([name, paneId]) => {
    applyIndicator(chart, name as ChartIndicatorName, {
      calcParams: LOWER_INDICATOR_PARAMS[name as ChartIndicatorName],
      enabled: preferences.indicators[name as ChartIndicatorName],
      isStack: false,
      paneOptions: {
        id: paneId,
        height: 120,
        minHeight: 80
      }
    });
  });
}

function applyIndicator(
  chart: Chart,
  name: ChartIndicatorName,
  options: {
    calcParams?: number[];
    enabled: boolean;
    isStack: boolean;
    paneOptions: { id: string; height?: number; minHeight?: number };
  }
) {
  const indicators = chart.getIndicators({ name });

  if (options.enabled && indicators.length === 0) {
    chart.createIndicator(
      {
        name,
        calcParams: options.calcParams
      },
      options.isStack,
      options.paneOptions
    );
  }

  if (!options.enabled && indicators.length > 0) {
    chart.removeIndicator({ name });
  }
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
  const klinechartsModule = await getKLineModule();
  registerVwapIndicator(klinechartsModule);

  const { init, dispose } = klinechartsModule;
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
    ) =>
      updateChart(
        chart,
        symbol,
        data,
        interval,
        preferences
      ),
    destroy: () => {
      resizeObserver.disconnect();
      dispose(chart);
    }
  };
}
