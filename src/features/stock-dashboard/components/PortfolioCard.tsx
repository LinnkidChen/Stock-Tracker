'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PortfolioHolding, PortfolioSummary } from '@/types/portfolio';
import { useWatchlistPrices } from '../hooks/useWatchlistPrices';
import { LoadingSkeleton } from './LoadingSkeleton';

const PORTFOLIO_ENDPOINT = '/api/portfolio/holdings';
const EMPTY_HOLDINGS: PortfolioHolding[] = [];

interface PortfolioData {
  holdings: PortfolioHolding[];
  summary: PortfolioSummary;
}

type ApiError = Error & { status?: number };

async function fetchPortfolio(): Promise<PortfolioData> {
  const response = await fetch(PORTFOLIO_ENDPOINT);
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    const error = new Error(
      payload?.error?.message || 'Failed to load portfolio holdings'
    ) as ApiError;
    error.status = response.status;
    throw error;
  }

  return payload.data as PortfolioData;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
}

function SummaryRow({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <span className='text-muted-foreground text-sm'>{label}</span>
      <span
        className={`text-sm font-medium ${
          tone === 'positive'
            ? 'text-green-600'
            : tone === 'negative'
              ? 'text-red-600'
              : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function PortfolioCard() {
  const query = useQuery({
    queryKey: ['portfolio', 'holdings'],
    queryFn: fetchPortfolio
  });
  const holdings = query.data?.holdings ?? EMPTY_HOLDINGS;
  const symbols = useMemo(
    () => holdings.map((holding) => holding.symbol),
    [holdings]
  );
  const { pricesMap, isLoading: pricesLoading } = useWatchlistPrices(symbols);

  const marketSummary = useMemo(() => {
    let marketValue = 0;
    let unrealizedPnl = 0;

    for (const holding of holdings) {
      const price = pricesMap[holding.symbol]?.price;
      if (!price) continue;

      const value = holding.quantity * price;
      marketValue += value;
      unrealizedPnl += value - holding.costBasis;
    }

    return { marketValue, unrealizedPnl };
  }, [holdings, pricesMap]);

  const realizedPnl = query.data?.summary.realizedPnl ?? 0;
  const totalPnl = realizedPnl + marketSummary.unrealizedPnl;

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Portfolio</CardTitle>
        <Button asChild size='sm' variant='outline'>
          <Link href='/dashboard/portfolio'>
            Open
            <ArrowRightIcon className='size-4' />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        {query.isLoading ? (
          <LoadingSkeleton count={3} />
        ) : query.isError ? (
          <div className='text-destructive text-sm'>
            Failed to load portfolio
          </div>
        ) : holdings.length === 0 ? (
          <div className='text-muted-foreground text-sm'>
            No ledger transactions yet. Open Portfolio to add one.
          </div>
        ) : (
          <>
            <div className='space-y-2'>
              <SummaryRow
                label='Market Value'
                value={
                  pricesLoading && marketSummary.marketValue === 0
                    ? 'Loading'
                    : formatCurrency(marketSummary.marketValue)
                }
              />
              <SummaryRow
                label='Unrealized P&L'
                value={formatCurrency(marketSummary.unrealizedPnl)}
                tone={
                  marketSummary.unrealizedPnl >= 0 ? 'positive' : 'negative'
                }
              />
              <SummaryRow
                label='Realized P&L'
                value={formatCurrency(realizedPnl)}
                tone={realizedPnl >= 0 ? 'positive' : 'negative'}
              />
              <SummaryRow
                label='Total P&L'
                value={formatCurrency(totalPnl)}
                tone={totalPnl >= 0 ? 'positive' : 'negative'}
              />
            </div>
            <div className='border-t pt-3'>
              <div className='text-muted-foreground mb-2 text-xs'>
                Holdings ({holdings.length})
              </div>
              <div className='space-y-2'>
                {holdings.slice(0, 4).map((holding) => (
                  <div
                    key={holding.id}
                    className='flex items-center justify-between gap-3 text-sm'
                  >
                    <span className='font-medium'>{holding.symbol}</span>
                    <span className='text-muted-foreground'>
                      {formatCurrency(holding.costBasis)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
