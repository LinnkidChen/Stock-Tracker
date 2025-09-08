import { NextResponse } from 'next/server';
import { mockStocks } from '@/lib/mock-data/stocks';

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { message: string; code?: string } };

export async function GET() {
  try {
    const portfolio = {
      holdings: [],
      totalValue: 0,
      dailyChange: 0
    };

    const watchlist = mockStocks.map((s) => ({
      symbol: s.symbol,
      name: s.name
    }));

    const marketData = {
      trending: mockStocks,
      indices: [
        { symbol: 'S&P 500', changePercent: 0.23 },
        { symbol: 'NASDAQ', changePercent: -0.15 },
        { symbol: 'DOW', changePercent: 0.05 }
      ]
    };

    const payload: ApiSuccess<{
      portfolio: any;
      watchlist: any;
      marketData: any;
    }> = {
      success: true,
      data: { portfolio, watchlist, marketData }
    };

    return NextResponse.json(payload, {
      headers: {
        // Cache on the edge for 60s, allow SWR for 30s
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30'
      }
    });
  } catch (e: any) {
    const err: ApiError = {
      success: false,
      error: { message: e?.message ?? 'Failed to fetch dashboard data' }
    };
    return NextResponse.json(err, { status: 500 });
  }
}
