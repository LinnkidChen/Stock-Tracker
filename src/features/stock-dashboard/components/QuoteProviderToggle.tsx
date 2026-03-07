'use client';

import { useDashboardStore } from '../store';
import { QUOTE_PROVIDER_OPTIONS } from '@/lib/providers/config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export function QuoteProviderToggle() {
  const { quoteProvider, setQuoteProvider } = useDashboardStore();

  return (
    <div className='flex items-center space-x-2'>
      <Label
        htmlFor='quote-provider'
        className='text-muted-foreground text-sm font-medium'
      >
        Source:
      </Label>
      <Select
        value={quoteProvider}
        onValueChange={setQuoteProvider}
        disabled
      >
        <SelectTrigger id='quote-provider' className='h-8 w-[140px]'>
          <div className='flex items-center gap-2'>
            <SelectValue placeholder='Select provider' />
          </div>
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
