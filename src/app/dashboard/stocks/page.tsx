import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardClient } from '@/features/stock-dashboard/components';

export default async function StocksPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  return (
    <div className='flex-1 space-y-4 p-4 pt-6'>
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <DashboardClient />
      </Suspense>
    </div>
  );
}
