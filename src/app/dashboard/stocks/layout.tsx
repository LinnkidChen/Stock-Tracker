import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stock Dashboard | Stock Tracker',
  description: 'Stock dashboard with market data, watchlist, and holdings'
};

export default function StocksLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className='min-h-full'>{children}</div>;
}
