'use client';

import { useDashboardStore } from '../store';
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
      <Select value={quoteProvider} onValueChange={setQuoteProvider}>
        <SelectTrigger id='quote-provider' className='h-8 w-[140px]'>
          <div className='flex items-center gap-2'>
            <SelectValue placeholder='Select provider' />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='default'>Default</SelectItem>
          <SelectItem value='longbridge'>Longbridge</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
