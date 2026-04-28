import type {
  DiagnosticStatus,
  SetupDiagnosticCheck,
  SetupDiagnostics
} from '@/lib/diagnostics/setup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconInfoCircle
} from '@tabler/icons-react';
import Link from 'next/link';

const READINESS_CHECK_IDS = new Set(['supabase', 'supabase-rls', 'longbridge']);

const STATUS_CLASS_NAMES: Record<DiagnosticStatus, string> = {
  ready:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  blocked:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
};

function getActionableChecks(
  diagnostics?: SetupDiagnostics
): SetupDiagnosticCheck[] {
  if (!diagnostics) {
    return [];
  }

  return diagnostics.checks.filter(
    (check) => READINESS_CHECK_IDS.has(check.id) && check.status !== 'ready'
  );
}

export function DashboardReadinessPanel({
  diagnostics
}: {
  diagnostics?: SetupDiagnostics;
}) {
  const actionableChecks = getActionableChecks(diagnostics);

  if (actionableChecks.length === 0) {
    return null;
  }

  const hasBlockedCheck = actionableChecks.some(
    (check) => check.status === 'blocked'
  );
  const Icon = hasBlockedCheck ? IconAlertTriangle : IconInfoCircle;

  return (
    <Card className='border-dashed'>
      <CardHeader className='gap-3'>
        <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
          <div className='flex gap-3'>
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                hasBlockedCheck
                  ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              )}
            >
              <Icon aria-hidden='true' className='size-5' />
            </div>
            <div className='space-y-1'>
              <CardTitle>Finish first-run setup</CardTitle>
              <CardDescription>
                Complete the remaining service configuration to unlock watchlist
                persistence and live market data.
              </CardDescription>
            </div>
          </div>
          <Button asChild variant='outline' size='sm'>
            <Link href='/dashboard/operations'>
              Open Operations
              <IconArrowRight aria-hidden='true' className='size-4' />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className='grid gap-3 md:grid-cols-2'>
          {actionableChecks.map((check) => (
            <div key={check.id} className='rounded-lg border p-3'>
              <div className='flex items-center justify-between gap-3'>
                <div className='font-medium'>{check.title}</div>
                <Badge
                  variant='outline'
                  className={STATUS_CLASS_NAMES[check.status]}
                >
                  {check.status}
                </Badge>
              </div>
              <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
                {check.summary}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
