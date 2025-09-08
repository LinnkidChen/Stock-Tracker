import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  DeepPartial,
  ChartOptions,
  CandlestickSeriesOptions
} from 'lightweight-charts';

export interface PriceChartHandle {
  update: (candleData: CandlestickData[]) => void;
  destroy: () => void;
}

export interface CreatePriceChartOptions {
  height?: number;
  theme?: 'light' | 'dark';
  initialData?: CandlestickData[];
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
  const { createChart, CandlestickSeries } = await getChartsModule();

  const { height = 400, theme = 'light', initialData = [] } = options;

  const isDark = theme === 'dark';

  const chartOptions: DeepPartial<ChartOptions> = {
    height,
    layout: {
      background: {
        type: 'solid',
        color: isDark ? '#0f0f0f' : '#ffffff'
      },
      textColor: isDark ? '#e5e7eb' : '#1f2937',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: 12
    },
    grid: {
      vertLines: {
        color: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)',
        style: 1,
        visible: true
      },
      horzLines: {
        color: isDark ? 'rgba(55, 65, 81, 0.3)' : 'rgba(229, 231, 235, 0.5)',
        style: 1,
        visible: true
      }
    },
    crosshair: {
      mode: 1,
      vertLine: {
        color: isDark ? 'rgba(147, 197, 253, 0.5)' : 'rgba(59, 130, 246, 0.5)',
        width: 1,
        style: 2,
        labelBackgroundColor: isDark ? '#1e40af' : '#2563eb'
      },
      horzLine: {
        color: isDark ? 'rgba(147, 197, 253, 0.5)' : 'rgba(59, 130, 246, 0.5)',
        width: 1,
        style: 2,
        labelBackgroundColor: isDark ? '#1e40af' : '#2563eb'
      }
    },
    rightPriceScale: {
      borderColor: isDark
        ? 'rgba(75, 85, 99, 0.3)'
        : 'rgba(209, 213, 219, 0.5)',
      scaleMargins: {
        top: 0.1,
        bottom: 0.1
      },
      autoScale: true,
      borderVisible: false
    },
    timeScale: {
      borderColor: isDark
        ? 'rgba(75, 85, 99, 0.3)'
        : 'rgba(209, 213, 219, 0.5)',
      timeVisible: true,
      secondsVisible: false,
      borderVisible: false,
      barSpacing: 12,
      minBarSpacing: 5,
      fixLeftEdge: true,
      fixRightEdge: true,
      tickMarkFormatter: (time: any) => {
        const date = new Date(time * 1000);
        const month = date.toLocaleDateString('en', { month: 'short' });
        const day = date.getDate();
        return `${month} ${day}`;
      }
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: true
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true
    },
    watermark: {
      visible: false
    },
    localization: {
      priceFormatter: (price: number) => {
        if (price >= 1000000) {
          return `$${(price / 1000000).toFixed(2)}M`;
        }
        return `$${price.toFixed(2)}`;
      }
    }
  };

  const chart: IChartApi = createChart(container, chartOptions);

  // Main candlestick series with improved colors
  const candlestickSeriesOptions: DeepPartial<CandlestickSeriesOptions> = {
    upColor: '#10b981',
    downColor: '#ef4444',
    borderDownColor: '#dc2626',
    borderUpColor: '#059669',
    wickDownColor: 'rgba(239, 68, 68, 0.8)',
    wickUpColor: 'rgba(16, 185, 129, 0.8)',
    borderVisible: true,
    priceLineWidth: 1,
    priceLineStyle: 2,
    lastValueVisible: true,
    priceLineVisible: true,
    priceFormat: {
      type: 'price',
      precision: 2,
      minMove: 0.01
    }
  };

  const candlestickSeries: ISeriesApi<'Candlestick'> = chart.addSeries(
    CandlestickSeries,
    candlestickSeriesOptions
  );

  // Set initial data
  if (initialData.length > 0) {
    candlestickSeries.setData(initialData);
  }

  // Handle resize
  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({
      height: container.clientHeight,
      width: container.clientWidth
    });
  });

  resizeObserver.observe(container);

  // Auto-fit content with padding
  requestAnimationFrame(() => {
    chart.timeScale().fitContent();

    // Add price lines for support/resistance levels if data exists
    if (initialData.length > 0) {
      const prices = initialData.map((d) => [d.high, d.low]).flat();
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);

      // Add subtle horizontal lines for key levels
      const levels = [
        {
          price: maxPrice,
          color: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)',
          title: 'Resistance'
        },
        {
          price: minPrice,
          color: isDark
            ? 'rgba(16, 185, 129, 0.2)'
            : 'rgba(16, 185, 129, 0.15)',
          title: 'Support'
        }
      ];

      levels.forEach((level) => {
        candlestickSeries.createPriceLine({
          price: level.price,
          color: level.color,
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: level.title
        });
      });
    }
  });

  return {
    update(candleData: CandlestickData[]) {
      candlestickSeries.setData(candleData);
      chart.timeScale().fitContent();
    },

    destroy() {
      resizeObserver.disconnect();
      chart.remove();
    }
  };
}
