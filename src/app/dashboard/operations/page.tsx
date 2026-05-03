import type { Metadata } from 'next';
import { SetupDiagnosticsPanel } from '@/features/operations/components/SetupDiagnosticsPanel';
import { getSetupDiagnostics } from '@/lib/diagnostics/setup';

export const metadata: Metadata = {
  title: 'Operations | Stock Tracker',
  description: 'Environment readiness diagnostics'
};

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const diagnostics = await getSetupDiagnostics();

  return (
    <div className='flex-1 space-y-4 p-4 pt-6'>
      <SetupDiagnosticsPanel diagnostics={diagnostics} />
    </div>
  );
}
