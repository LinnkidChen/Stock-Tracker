import {
  applyErrorSpanAttributes,
  classifyPersistenceError,
  createErrorLogContext,
  getDashboardErrorMessage,
  getErrorStatusCode,
  toDashboardError
} from './error-taxonomy';

describe('error taxonomy', () => {
  it('maps canonical codes to HTTP statuses', () => {
    expect(getErrorStatusCode('INVALID_SYMBOL')).toBe(400);
    expect(getErrorStatusCode('API_LIMIT_EXCEEDED')).toBe(429);
    expect(getErrorStatusCode('RLS_AUTH_MISCONFIGURED')).toBe(503);
    expect(getErrorStatusCode('NETWORK_ERROR')).toBe(502);
  });

  it('preserves user-actionable validation messages', () => {
    expect(
      getDashboardErrorMessage({
        code: 'INVALID_SYMBOL',
        message: 'Ticker symbol is required'
      })
    ).toBe('Ticker symbol is required');
  });

  it('uses dashboard-safe messages for provider failures', () => {
    expect(
      toDashboardError({
        code: 'NETWORK_ERROR',
        message: 'Longbridge network request failed',
        details: {
          upstream: {
            message: 'gateway timeout'
          }
        }
      })
    ).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Market data is temporarily unavailable.',
      details: undefined
    });
  });

  it('adds log context, Sentry tags, and alert thresholds', () => {
    const context = createErrorLogContext('API_LIMIT_EXCEEDED', {
      provider: 'longbridge',
      path: '/api/stocks/quote/AAPL',
      operation: 'stock.quote',
      errorDomain: 'stock-data'
    });

    expect(context).toMatchObject({
      errorCode: 'API_LIMIT_EXCEEDED',
      errorCategory: 'rate_limit',
      errorDomain: 'stock-data',
      sentryLevel: 'warning'
    });
    expect(context.alertThreshold).toContain('10 events / 5 min');
    expect(context.sentryTags).toMatchObject({
      'app.error_code': 'API_LIMIT_EXCEEDED',
      'app.error_category': 'rate_limit',
      'app.provider': 'longbridge',
      'app.route': '/api/stocks/quote/AAPL'
    });
  });

  it('classifies Supabase RLS policy errors', () => {
    expect(
      classifyPersistenceError({
        originalError: {
          code: '42501',
          message: 'new row violates row-level security policy'
        }
      })
    ).toBe('RLS_ACCESS_DENIED');
  });

  it('applies taxonomy attributes to Sentry spans', () => {
    const setAttributes = jest.fn();

    applyErrorSpanAttributes({ setAttributes }, 'RLS_AUTH_MISCONFIGURED', {
      path: '/api/watchlist',
      operation: 'watchlist.fetch',
      errorDomain: 'watchlist'
    });

    expect(setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        'error.code': 'RLS_AUTH_MISCONFIGURED',
        'error.category': 'persistence',
        'error.domain': 'watchlist',
        'error.context.path': '/api/watchlist',
        'error.context.operation': 'watchlist.fetch'
      })
    );
  });
});
