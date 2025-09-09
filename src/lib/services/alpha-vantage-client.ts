import {
  AlphaVantageResponse,
  APIError,
  StockSearchResult
} from '../types/stock-api';

export class AlphaVantageClient {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://www.alphavantage.co/query';

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ALPHA_VANTAGE_API_KEY;
    if (!key) {
      throw new Error('Alpha Vantage API key is required');
    }
    this.apiKey = key;
  }

  async fetchQuote(symbol: string): Promise<AlphaVantageResponse> {
    // Validate symbol
    if (!/^[A-Za-z0-9]+$/.test(symbol)) {
      throw {
        code: 'INVALID_SYMBOL',
        message: 'Symbol must contain only alphanumeric characters'
      } as APIError;
    }

    const params = new URLSearchParams({
      function: 'GLOBAL_QUOTE',
      symbol: symbol.toUpperCase(),
      apikey: this.apiKey
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check for API errors
      if (data['Error Message']) {
        const error: APIError = {
          code: 'INVALID_SYMBOL',
          message: data['Error Message']
        };
        throw error;
      }

      if (data['Note']) {
        const error: APIError = {
          code: 'API_LIMIT_EXCEEDED',
          message: 'API call frequency limit exceeded',
          details: { note: data['Note'] }
        };
        throw error;
      }

      if (
        !data['Global Quote'] ||
        Object.keys(data['Global Quote']).length === 0
      ) {
        const error: APIError = {
          code: 'INVALID_SYMBOL',
          message: `No data found for symbol: ${symbol}`
        };
        throw error;
      }

      return data as AlphaVantageResponse;
    } catch (error) {
      // Check if it's already an APIError
      if (error && typeof error === 'object' && 'code' in error) {
        throw error;
      }

      const apiError: APIError = {
        code: 'NETWORK_ERROR',
        message:
          error instanceof Error ? error.message : 'Network request failed',
        details: { originalError: error }
      };
      throw apiError;
    }
  }

  async searchSymbol(keywords: string): Promise<StockSearchResult[]> {
    const params = new URLSearchParams({
      function: 'SYMBOL_SEARCH',
      keywords,
      apikey: this.apiKey
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.bestMatches || [];
    } catch (error) {
      const apiError: APIError = {
        code: 'NETWORK_ERROR',
        message:
          error instanceof Error ? error.message : 'Network request failed',
        details: { originalError: error }
      };
      throw apiError;
    }
  }
}

// Create a new client instance for each request (stateless)
export function getAlphaVantageClient(): AlphaVantageClient {
  return new AlphaVantageClient();
}
