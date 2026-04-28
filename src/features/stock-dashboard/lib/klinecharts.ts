import type { Chart, KLineData } from 'klinecharts';
import type { KLineInterval } from '@/lib/types/stock-api';
import {
  DEFAULT_CHART_WORKSPACE,
  type ChartPreferences
} from './chart-workspace';

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
      id: 'volume-pane',
      height: 120,
      minHeight: 80
    });
  }

  if (!preferences.showVolume && volumeIndicators.length > 0) {
    chart.removeIndicator({ name: 'VOL' });
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
