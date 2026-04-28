import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { DashboardClient } from '@/features/stock-dashboard/components';
import { getSetupDiagnostics } from '@/lib/diagnostics/setup';

export default async function StocksPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  const diagnostics = await getSetupDiagnostics();

  return (
    <div className='flex-1 space-y-4 p-4 pt-6'>
      <Suspense fallback={<div>Loading dashboard...</div>}>
        <DashboardClient diagnostics={diagnostics} />
      </Suspense>
    </div>
  );
}
