import { Stock } from '@/lib/types';

export const mockStocks: Stock[] = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 150.0,
    change: 2.5,
    changePercent: 1.69
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    price: 2800.0,
    change: -15.0,
    changePercent: -0.53
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 300.0,
    change: 1.2,
    changePercent: 0.4
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    price: 3400.0,
    change: 25.5,
    changePercent: 0.76
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    price: 700.0,
    change: -5.0,
    changePercent: -0.71
  }
];
