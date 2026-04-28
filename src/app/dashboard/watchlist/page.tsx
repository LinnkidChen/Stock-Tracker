import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { WatchlistCard } from '@/features/stock-dashboard/components';

export default async function WatchlistPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  return (
    <div className='flex-1 space-y-4 p-4 pt-6'>
      <div>
        <h1 className='text-3xl font-bold'>Watchlist</h1>
        <p className='text-muted-foreground text-sm'>
          Symbols, groups, notes, and live price refresh
        </p>
      </div>
      <WatchlistCard />
    </div>
  );
}
