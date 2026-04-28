import type {
  DiagnosticStatus,
  SetupDiagnosticCheck,
  SetupDiagnostics
} from '@/lib/diagnostics/setup';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle
} from '@tabler/icons-react';

interface SetupDiagnosticsPanelProps {
  diagnostics: SetupDiagnostics;
}

const STATUS_META: Record<
  DiagnosticStatus,
  {
    label: string;
    badgeClassName: string;
    iconClassName: string;
    Icon: typeof IconCircleCheck;
  }
> = {
  ready: {
    label: 'Ready',
    badgeClassName:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
    Icon: IconCircleCheck
  },
  warning: {
    label: 'Warning',
    badgeClassName:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    iconClassName: 'text-amber-600 dark:text-amber-400',
    Icon: IconInfoCircle
  },
  blocked: {
    label: 'Blocked',
    badgeClassName:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    iconClassName: 'text-red-600 dark:text-red-400',
    Icon: IconAlertTriangle
  }
};

function DiagnosticCard({ check }: { check: SetupDiagnosticCheck }) {
  const meta = STATUS_META[check.status];
  const StatusIcon = meta.Icon;

  return (
    <Card className='gap-4'>
      <CardHeader className='gap-3'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex min-w-0 items-start gap-3'>
            <StatusIcon
              aria-hidden='true'
              className={cn('mt-0.5 size-5 shrink-0', meta.iconClassName)}
            />
            <div className='min-w-0 space-y-1'>
              <CardTitle className='text-base'>{check.title}</CardTitle>
              <CardDescription>{check.summary}</CardDescription>
            </div>
          </div>
          <Badge variant='outline' className={meta.badgeClassName}>
            {meta.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Separator />
        <ul className='text-muted-foreground space-y-2 text-sm'>
          {check.details.map((detail) => (
            <li key={detail} className='leading-relaxed'>
              {detail}
            </li>
          ))}
        </ul>
        {check.remediation ? (
          <div className='bg-muted/50 rounded-lg border p-3 text-sm'>
            <div className='font-medium'>Remediation</div>
            <p className='text-muted-foreground mt-1 leading-relaxed'>
              {check.remediation}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SetupDiagnosticsPanel({
  diagnostics
}: SetupDiagnosticsPanelProps) {
  const meta = STATUS_META[diagnostics.status];
  const StatusIcon = meta.Icon;

  return (
    <div className='space-y-6'>
      <div className='flex flex-col gap-4 md:flex-row md:items-start md:justify-between'>
        <div className='space-y-2'>
          <div className='flex items-center gap-3'>
            <StatusIcon
              aria-hidden='true'
              className={cn('size-6', meta.iconClassName)}
            />
            <h1 className='text-3xl font-bold tracking-normal'>Operations</h1>
          </div>
          <p className='text-muted-foreground max-w-3xl text-sm leading-relaxed'>
            {diagnostics.summary}
          </p>
        </div>
        <div className='flex flex-wrap items-center gap-3 md:justify-end'>
          <Badge variant='outline' className={meta.badgeClassName}>
            Overall: {meta.label}
          </Badge>
          <span className='text-muted-foreground text-xs'>
            Generated {diagnostics.generatedAt}
          </span>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-3'>
        {diagnostics.checks.map((check) => (
          <DiagnosticCard key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}
