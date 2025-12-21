import { Suspense } from 'react';
import { ChartPageClient } from '@/features/stock-dashboard/components/ChartPageClient';

// Server Component (default)
export default function ChartsPage() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <ChartPageClient />
    </Suspense>
  );
}
