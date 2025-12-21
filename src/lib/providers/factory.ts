import { StockDataProvider } from './types';
import { AlphaVantageProvider } from './alpha-vantage';
import { LongbridgeProvider } from './longbridge';

export class StockProviderFactory {
  static getProvider(name: string): StockDataProvider {
    switch (name.toLowerCase()) {
      case 'longbridge':
        return new LongbridgeProvider();
      case 'default':
      case 'alphavantage':
      default:
        return new AlphaVantageProvider();
    }
  }
}
