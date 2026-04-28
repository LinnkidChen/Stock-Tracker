/**
 * @jest-environment jsdom
 */
import type { KLineData } from 'klinecharts';
import {
  createKLineChart,
  createVwapIndicatorTemplate
} from './klinecharts';
import {
  DEFAULT_CHART_INDICATORS,
  type ChartPreferences
} from './chart-workspace';

const mockInit = jest.fn();
const mockDispose = jest.fn();
const mockGetSupportedIndicators = jest.fn();
const mockRegisterIndicator = jest.fn();

jest.mock('klinecharts', () => ({
  __esModule: true,
  init: (...args: unknown[]) => mockInit(...args),
  dispose: (...args: unknown[]) => mockDispose(...args),
  getSupportedIndicators: (...args: unknown[]) =>
    mockGetSupportedIndicators(...args),
  registerIndicator: (...args: unknown[]) => mockRegisterIndicator(...args)
}));

class ResizeObserverMock {
  observe = jest.fn();
  disconnect = jest.fn();
}

function createMockChart() {
  const indicators: Array<{ name: string }> = [];

  return {
    setStyles: jest.fn(),
    setSymbol: jest.fn(),
    setPeriod: jest.fn(),
    setDataLoader: jest.fn(),
    resetData: jest.fn(),
    getIndicators: jest.fn(({ name }: { name?: string } = {}) =>
      name ? indicators.filter((indicator) => indicator.name === name) : indicators
    ),
    createIndicator: jest.fn((value: string | { name: string }) => {
      indicators.push({
        name: typeof value === 'string' ? value : value.name
      });
      return `${typeof value === 'string' ? value : value.name}-id`;
    }),
    removeIndicator: jest.fn(({ name }: { name?: string } = {}) => {
      if (!name) {
        indicators.splice(0);
        return true;
      }

      const index = indicators.findIndex((indicator) => indicator.name === name);
      if (index === -1) {
        return false;
      }

      indicators.splice(index, 1);
      return true;
    }),
    resize: jest.fn()
  };
}

function buildPreferences(
  indicators: Partial<ChartPreferences['indicators']>
): ChartPreferences {
  return {
    showVolume: false,
    showGrid: true,
    candleType: 'candle_solid',
    indicators: {
      ...DEFAULT_CHART_INDICATORS,
      ...indicators
    }
  };
}

describe('klinecharts adapter indicators', () => {
  beforeAll(() => {
    global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  });

  beforeEach(() => {
    mockInit.mockReset();
    mockDispose.mockReset();
    mockGetSupportedIndicators.mockReset();
    mockRegisterIndicator.mockReset();
    mockGetSupportedIndicators.mockReturnValue([
      'MA',
      'EMA',
      'RSI',
      'MACD',
      'BOLL',
      'VOL'
    ]);
  });

  it('registers VWAP once and creates enabled indicators in the correct panes', async () => {
    const chart = createMockChart();
    mockInit.mockReturnValue(chart);

    await createKLineChart(document.createElement('div'), {
      symbol: 'AAPL',
      interval: 'day',
      data: [],
      preferences: buildPreferences({
        MA: true,
        VWAP: true,
        RSI: true
      })
    });

    await createKLineChart(document.createElement('div'), {
      symbol: 'MSFT',
      interval: 'day',
      data: [],
      preferences: buildPreferences({})
    });

    expect(mockRegisterIndicator).toHaveBeenCalledTimes(1);
    expect(mockRegisterIndicator).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'VWAP' })
    );
    expect(chart.createIndicator).toHaveBeenCalledWith(
      { name: 'MA', calcParams: [5, 10, 30, 60] },
      true,
      { id: 'candle_pane' }
    );
    expect(chart.createIndicator).toHaveBeenCalledWith(
      { name: 'VWAP', calcParams: [20] },
      true,
      { id: 'candle_pane' }
    );
    expect(chart.createIndicator).toHaveBeenCalledWith(
      { name: 'RSI', calcParams: [6, 12, 24] },
      false,
      { id: 'rsi-pane', height: 120, minHeight: 80 }
    );
  });

  it('applies indicator changes idempotently and removes disabled indicators', async () => {
    const chart = createMockChart();
    mockInit.mockReturnValue(chart);

    const handle = await createKLineChart(document.createElement('div'), {
      symbol: 'AAPL',
      interval: 'day',
      data: [],
      preferences: buildPreferences({
        MA: true,
        MACD: true
      })
    });

    const createCallsAfterInit = chart.createIndicator.mock.calls.length;

    handle.update('AAPL', [], 'day', buildPreferences({ MA: true, MACD: true }));

    expect(chart.createIndicator).toHaveBeenCalledTimes(createCallsAfterInit);

    handle.update('AAPL', [], 'day', buildPreferences({}));

    expect(chart.removeIndicator).toHaveBeenCalledWith({ name: 'MA' });
    expect(chart.removeIndicator).toHaveBeenCalledWith({ name: 'MACD' });
  });

  it('calculates VWAP from rolling typical price times volume', () => {
    const template = createVwapIndicatorTemplate();
    const candles: KLineData[] = [
      {
        timestamp: 1,
        open: 0,
        high: 12,
        low: 6,
        close: 9,
        volume: 10
      },
      {
        timestamp: 2,
        open: 0,
        high: 18,
        low: 12,
        close: 15,
        volume: 20
      },
      {
        timestamp: 3,
        open: 0,
        high: 30,
        low: 18,
        close: 24,
        volume: 10
      }
    ];

    const result = template.calc(candles, {
      calcParams: [2]
    } as Parameters<typeof template.calc>[1]);

    expect(template.calcParams).toEqual([20]);
    expect(result).toEqual([
      {},
      { vwap: 13 },
      { vwap: 18 }
    ]);
  });
});
