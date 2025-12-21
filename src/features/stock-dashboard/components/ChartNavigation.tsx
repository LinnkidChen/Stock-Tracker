'use client';

import Link from 'next/link';
import { ArrowRight, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDashboardStore } from '../store';

export function ChartNavigation() {
  const { selectedTicker } = useDashboardStore();

  const href = selectedTicker
    ? `/dashboard/charts?symbol=${selectedTicker}`
    : '/dashboard/charts';

  return (
    <div className='group relative overflow-hidden rounded-xl border bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-6 transition-all hover:shadow-lg dark:from-indigo-500/20 dark:via-purple-500/20 dark:to-pink-500/20'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <div className='bg-background rounded-lg p-3 shadow-sm transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400'>
            <BarChart2 className='h-6 w-6' />
          </div>
          <div>
            <h3 className='font-semibold tracking-tight'>Technical Analysis</h3>
            <p className='text-muted-foreground text-sm'>
              {selectedTicker
                ? `Analyze price action and indicators for ${selectedTicker}`
                : 'Advanced K-Line charts and market data'}
            </p>
          </div>
        </div>
        <Button
          asChild
          className='transition-transform group-hover:translate-x-1'
          variant={selectedTicker ? 'default' : 'outline'}
        >
          <Link href={href}>
            {selectedTicker ? 'Open Chart' : 'Go to Charts'}
            <ArrowRight className='ml-2 h-4 w-4' />
          </Link>
        </Button>
      </div>
    </div>
  );
}
