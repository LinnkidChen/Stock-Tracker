import type { Chart, KLineData } from 'klinecharts';

export interface KLineChartHandle {
  update: (symbol: string, data: KLineData[]) => void;
  destroy: () => void;
}

export interface CreateKLineChartOptions {
  symbol: string;
  data?: KLineData[];
}

let klineModule: typeof import('klinecharts') | null = null;

async function getKLineModule() {
  if (!klineModule) {
    klineModule = await import('klinecharts');
  }
  return klineModule;
}

function applyData(chart: Chart, symbol: string, data: KLineData[]) {
  chart.setSymbol({
    ticker: symbol,
    pricePrecision: 2,
    volumePrecision: 0
  });
  chart.setPeriod({ type: 'day', span: 1 });
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

  applyData(chart, options.symbol, options.data ?? []);

  const resizeObserver = new ResizeObserver(() => {
    chart.resize();
  });

  resizeObserver.observe(container);

  return {
    update: (symbol, data) => applyData(chart, symbol, data),
    destroy: () => {
      resizeObserver.disconnect();
      dispose(chart);
    }
  };
}
