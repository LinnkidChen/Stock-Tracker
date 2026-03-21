import type { Chart, KLineData } from 'klinecharts';
import type { KLineInterval } from '@/lib/types/stock-api';

export interface KLineChartHandle {
  update: (symbol: string, data: KLineData[], interval: KLineInterval) => void;
  destroy: () => void;
}

export interface CreateKLineChartOptions {
  symbol: string;
  interval: KLineInterval;
  data?: KLineData[];
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

export async function createKLineChart(
  container: HTMLElement,
  options: CreateKLineChartOptions
): Promise<KLineChartHandle> {
  const { init, dispose } = await getKLineModule();
  const chart = init(container);

  if (!chart) {
    throw new Error('Failed to initialize kline chart');
  }

  applyData(chart, options.symbol, options.data ?? [], options.interval);

  const resizeObserver = new ResizeObserver(() => {
    chart.resize();
  });

  resizeObserver.observe(container);

  return {
    update: (symbol, data, interval) =>
      applyData(chart, symbol, data, interval),
    destroy: () => {
      resizeObserver.disconnect();
      dispose(chart);
    }
  };
}
