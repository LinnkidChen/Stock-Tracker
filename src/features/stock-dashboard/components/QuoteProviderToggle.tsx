'use client';

import { useDashboardStore } from '../store';
import { QUOTE_PROVIDER_OPTIONS } from '@/lib/providers/config';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export function QuoteProviderToggle() {
  const quoteProvider = useDashboardStore((state) => state.quoteProvider);
  const providerLabel =
    QUOTE_PROVIDER_OPTIONS.find((provider) => provider.value === quoteProvider)
      ?.label ?? quoteProvider;

  return (
    <div className='flex items-center space-x-2'>
      <Label className='text-muted-foreground text-sm font-medium'>
        Source:
      </Label>
      <Badge
        variant='outline'
        className='h-8 min-w-[140px] justify-center rounded-md px-3 text-xs font-medium'
      >
        {providerLabel}
      </Badge>
    </div>
  );
}
