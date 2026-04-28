'use client';

import { useDashboardStore } from '../store';
import { QUOTE_PROVIDER_OPTIONS } from '@/lib/providers/config';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

export function QuoteProviderToggle() {
  const quoteProvider = useDashboardStore((state) => state.quoteProvider);
  const setQuoteProvider = useDashboardStore((state) => state.setQuoteProvider);

  return (
    <div className='flex items-center space-x-2'>
      <Label className='text-muted-foreground text-sm font-medium'>
        Source:
      </Label>
      <Select value={quoteProvider} onValueChange={setQuoteProvider}>
        <SelectTrigger
          size='sm'
          className='h-8 min-w-[160px] text-xs font-medium'
          aria-label='Quote data source'
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUOTE_PROVIDER_OPTIONS.map((provider) => (
            <SelectItem key={provider.value} value={provider.value}>
              {provider.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
