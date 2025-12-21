import { ADD_TICKER_ERROR_COPY, getAddTickerError } from '../add-ticker-error';

describe('getAddTickerError', () => {
  it('maps validation failures with provided message', () => {
    const error = getAddTickerError({
      type: 'validation',
      message: 'Ticker symbol must contain only letters'
    });

    expect(error.category).toBe('validation');
    expect(error.title).toBe(ADD_TICKER_ERROR_COPY.validation.title);
    expect(error.message).toBe('Ticker symbol must contain only letters');
    expect(error.nextStep).toBe(ADD_TICKER_ERROR_COPY.validation.nextStep);
    expect(error.source).toBe('client');
  });

  it('maps duplicate failures with default copy', () => {
    const error = getAddTickerError({ type: 'duplicate' });

    expect(error.category).toBe('duplicate');
    expect(error.title).toBe(ADD_TICKER_ERROR_COPY.duplicate.title);
    expect(error.message).toBe(ADD_TICKER_ERROR_COPY.duplicate.message);
    expect(error.nextStep).toBe(ADD_TICKER_ERROR_COPY.duplicate.nextStep);
    expect(error.source).toBe('client');
  });

  it('maps 429 responses to rate limited copy', () => {
    const error = getAddTickerError({ type: 'http', status: 429 });

    expect(error.category).toBe('rate_limited');
    expect(error.title).toBe(ADD_TICKER_ERROR_COPY.rate_limited.title);
    expect(error.message).toBe(ADD_TICKER_ERROR_COPY.rate_limited.message);
    expect(error.nextStep).toBe(ADD_TICKER_ERROR_COPY.rate_limited.nextStep);
    expect(error.source).toBe('server');
    expect(error.httpStatus).toBe(429);
  });

  it('maps network failures to network copy', () => {
    const error = getAddTickerError({
      type: 'network',
      error: new Error('Network down')
    });

    expect(error.category).toBe('network');
    expect(error.title).toBe(ADD_TICKER_ERROR_COPY.network.title);
    expect(error.message).toBe(ADD_TICKER_ERROR_COPY.network.message);
    expect(error.nextStep).toBe(ADD_TICKER_ERROR_COPY.network.nextStep);
    expect(error.source).toBe('client');
  });

  it('falls back to unknown copy for unexpected errors', () => {
    const error = getAddTickerError({
      type: 'unknown',
      error: new Error('Boom')
    });

    expect(error.category).toBe('unknown');
    expect(error.title).toBe(ADD_TICKER_ERROR_COPY.unknown.title);
    expect(error.message).toBe(ADD_TICKER_ERROR_COPY.unknown.message);
    expect(error.nextStep).toBe(ADD_TICKER_ERROR_COPY.unknown.nextStep);
    expect(error.source).toBe('client');
  });
});
