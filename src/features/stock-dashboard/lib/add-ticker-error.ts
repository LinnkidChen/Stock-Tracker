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

export function getAddTickerError(input: AddTickerErrorInput): AddTickerError {
  const fallback = ADD_TICKER_ERROR_COPY.unknown;

  if (input.type === 'validation') {
    const copy = ADD_TICKER_ERROR_COPY.validation;
    return {
      category: 'validation',
      title: copy.title,
      message: input.message ?? copy.message,
      nextStep: copy.nextStep,
      source: 'client'
    };
  }

  if (input.type === 'duplicate') {
    const copy = ADD_TICKER_ERROR_COPY.duplicate;
    return {
      category: 'duplicate',
      title: copy.title,
      message: copy.message,
      nextStep: copy.nextStep,
      source: 'client'
    };
  }

  if (input.type === 'http') {
    if (input.status === 429) {
      const copy = ADD_TICKER_ERROR_COPY.rate_limited;
      return {
        category: 'rate_limited',
        title: copy.title,
        message: copy.message,
        nextStep: copy.nextStep,
        source: 'server',
        httpStatus: input.status
      };
    }

    if (input.status === 400) {
      const copy = ADD_TICKER_ERROR_COPY.unsupported;
      return {
        category: 'unsupported',
        title: copy.title,
        message: copy.message,
        nextStep: copy.nextStep,
        source: 'server',
        httpStatus: input.status
      };
    }

    const copy = ADD_TICKER_ERROR_COPY.unknown;
    return {
      category: 'unknown',
      title: copy.title,
      message: copy.message,
      nextStep: copy.nextStep,
      source: 'server',
      httpStatus: input.status
    };
  }

  if (input.type === 'network') {
    const copy = ADD_TICKER_ERROR_COPY.network;
    return {
      category: 'network',
      title: copy.title,
      message: copy.message,
      nextStep: copy.nextStep,
      source: 'client'
    };
  }

  if (input.type === 'unknown') {
    const copy = ADD_TICKER_ERROR_COPY.unknown;
    return {
      category: 'unknown',
      title: copy.title,
      message: copy.message,
      nextStep: copy.nextStep,
      source: 'client'
    };
  }

  return {
    category: 'unknown',
    title: fallback.title,
    message: fallback.message,
    nextStep: fallback.nextStep,
    source: 'client'
  };
}
