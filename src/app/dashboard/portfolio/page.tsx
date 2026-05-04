import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { PortfolioManager } from '@/features/stock-dashboard/components/PortfolioManager';

export default async function PortfolioPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/auth/sign-in');
  }

  return (
    <div className='flex-1 p-4 pt-6'>
      <PortfolioManager />
    </div>
  );
}
