import { StockDataProvider } from './types';
import { LongbridgeProvider } from './longbridge';
import { APIError } from '../types/stock-api';
import { resolveQuoteProvider } from './config';

export class StockProviderFactory {
  static getProvider(name?: string | null): StockDataProvider {
    const provider = resolveQuoteProvider(name);

    if (!provider) {
      throw {
        code: 'INVALID_PROVIDER',
        message: `Unsupported provider: ${name}`
      } as APIError;
    }

    switch (provider) {
      case 'longbridge':
      default:
        return new LongbridgeProvider();
    }
  }
}
