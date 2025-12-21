import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advanced Charts | Stock Tracker',
  description: 'Interactive technical analysis charts'
};

export default function ChartsLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className='h-full w-full p-6'>{children}</div>;
}
