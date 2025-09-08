import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  DeepPartial,
  ChartOptions,
  CandlestickSeriesOptions,
  HistogramSeriesOptions
} from 'lightweight-charts';

export interface PriceChartHandle {
  update: (candleData: CandlestickData[], volumeData: HistogramData[]) => void;
  destroy: () => void;
}

export interface CreatePriceChartOptions {
  height?: number;
  theme?: 'light' | 'dark';
  initialData?: CandlestickData[];
  volumeData?: HistogramData[];
}

// Lazy load the charts library
let chartsModule: typeof import('lightweight-charts') | null = null;

async function getChartsModule() {
  if (!chartsModule) {
    chartsModule = await import('lightweight-charts');
  }
  return chartsModule;
}

export async function createPriceChart(
  container: HTMLElement,
  options: CreatePriceChartOptions = {}
): Promise<PriceChartHandle> {
  const { createChart } = await getChartsModule();

  const {
    height = 400,
    theme = 'light',
    initialData = [],
    volumeData = []
  } = options;

  const isDark = theme === 'dark';

  const chartOptions: DeepPartial<ChartOptions> = {
    height,
    layout: {
      background: { color: 'transparent' },
      textColor: isDark ? '#D1D5DB' : '#374151'
    },
    grid: {
      vertLines: { color: isDark ? '#374151' : '#E5E7EB' },
      horzLines: { color: isDark ? '#374151' : '#E5E7EB' }
    },
    crosshair: {
      mode: 1
    },
    rightPriceScale: {
      borderColor: isDark ? '#4B5563' : '#D1D5DB'
    },
    timeScale: {
      borderColor: isDark ? '#4B5563' : '#D1D5DB',
      timeVisible: true,
      secondsVisible: false
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true
    }
  };

  const chart: IChartApi = createChart(container, chartOptions);

  // Main candlestick series
  const candlestickSeriesOptions: DeepPartial<CandlestickSeriesOptions> = {
    upColor: '#16a34a',
    downColor: '#ef4444',
    borderDownColor: '#ef4444',
    borderUpColor: '#16a34a',
    wickDownColor: '#ef4444',
    wickUpColor: '#16a34a'
  };

  const candlestickSeries: ISeriesApi<'Candlestick'> =
    chart.addCandlestickSeries(candlestickSeriesOptions);

  // Volume histogram series
  const volumeSeriesOptions: DeepPartial<HistogramSeriesOptions> = {
    color: '#6B7280',
    priceFormat: {
      type: 'volume'
    },
    priceScaleId: '', // Use separate price scale
    scaleMargins: {
      top: 0.7, // Volume takes up bottom 30%
      bottom: 0
    }
  };

  const volumeSeries: ISeriesApi<'Histogram'> =
    chart.addHistogramSeries(volumeSeriesOptions);

  // Set initial data
  if (initialData.length > 0) {
    candlestickSeries.setData(initialData);
  }

  if (volumeData.length > 0) {
    volumeSeries.setData(volumeData);
  }

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({
      height: container.clientHeight,
      width: container.clientWidth
    });
  });

  resizeObserver.observe(container);

  // Auto-fit content
  requestAnimationFrame(() => {
    chart.timeScale().fitContent();
  });

  return {
    update(candleData: CandlestickData[], newVolumeData: HistogramData[]) {
      candlestickSeries.setData(candleData);
      volumeSeries.setData(newVolumeData);
      chart.timeScale().fitContent();
    },

    destroy() {
      resizeObserver.disconnect();
      chart.remove();
    }
  };
}
