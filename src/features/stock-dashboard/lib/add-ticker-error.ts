export type AddTickerErrorCategory =
  | 'validation'
  | 'duplicate'
  | 'rate_limited'
  | 'network'
  | 'unsupported'
  | 'unknown';

export type AddTickerErrorSource = 'client' | 'server';

export interface AddTickerError {
  category: AddTickerErrorCategory;
  title: string;
  message: string;
  nextStep: string;
  source: AddTickerErrorSource;
  httpStatus?: number;
}

export interface AddTickerErrorCopy {
  title: string;
  message: string;
  nextStep: string;
}

export const ADD_TICKER_ERROR_COPY: Record<
  AddTickerErrorCategory,
  AddTickerErrorCopy
> = {
  validation: {
    title: 'Invalid symbol',
    message: 'Ticker symbols must be 1-5 letters.',
    nextStep: 'Use 1-5 letters, like MSFT, and try again.'
  },
  duplicate: {
    title: 'Already in your watchlist',
    message: 'That symbol is already in your watchlist.',
    nextStep: 'Check your list or add a different symbol.'
  },
  rate_limited: {
    title: 'Too many requests',
    message: 'You are adding symbols too quickly.',
    nextStep: 'Wait a moment and try again.'
  },
  network: {
    title: 'Connection issue',
    message: 'We could not reach the server.',
    nextStep: 'Check your connection and retry.'
  },
  unsupported: {
    title: 'Symbol not supported',
    message: 'We could not add that ticker.',
    nextStep: 'Check the spelling or try another symbol.'
  },
  unknown: {
    title: 'Something went wrong',
    message: 'We could not add that symbol.',
    nextStep: 'Try again later or contact support.'
  }
};

export type AddTickerErrorInput =
  | { type: 'validation'; message?: string }
  | { type: 'duplicate' }
  | { type: 'http'; status: number; message?: string }
  | { type: 'network'; error?: unknown }
  | { type: 'unknown'; error?: unknown };

function createError(
  category: AddTickerErrorCategory,
  source: AddTickerErrorSource,
  httpStatus?: number,
  messageOverride?: string
): AddTickerError {
  const copy = ADD_TICKER_ERROR_COPY[category];
  return {
    category,
    title: copy.title,
    message: messageOverride ?? copy.message,
    nextStep: copy.nextStep,
    source,
    httpStatus
  };
}

export function getAddTickerError(input: AddTickerErrorInput): AddTickerError {
  if (input.type === 'validation') {
    return createError('validation', 'client', undefined, input.message);
  }

  if (input.type === 'duplicate') {
    return createError('duplicate', 'client');
  }

  if (input.type === 'http') {
    if (input.status === 429) {
      return createError('rate_limited', 'server', input.status);
    }

    if (input.status === 400) {
      // 400 Bad Request often implies invalid input (symbol)
      // Use validation category but attribute to server
      return createError('validation', 'server', input.status, input.message);
    }

    // Default HTTP error to unknown or unsupported?
    // Plan said: Map 400 to 'validation', rest default.
    // Preserving logic for other statuses to map to unknown as per previous,
    // although previous had a specific 'unsupported' mapping for 400.
    return createError('unknown', 'server', input.status, input.message);
  }

  if (input.type === 'network') {
    return createError('network', 'client');
  }

  return createError('unknown', 'client');
}
