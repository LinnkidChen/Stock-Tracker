import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stock Dashboard | Stock Tracker',
  description:
    'Real-time stock portfolio dashboard with interactive charts and market data'
};

export default function StocksLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className='min-h-full'>{children}</div>;
}
