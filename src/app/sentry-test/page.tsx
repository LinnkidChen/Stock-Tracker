'use client';

import { Button } from '@/components/ui/button';

export default function SentryTestPage() {
  return (
    <div className='flex h-screen w-full flex-col items-center justify-center gap-4'>
      <h1 className='text-2xl font-bold'>Sentry Verification</h1>
      <p className='text-muted-foreground'>
        Click the button below to test Sentry error reporting.
      </p>
      <Button
        variant='destructive'
        onClick={() => {
          throw new Error(
            'Sentry Client Test Error: ' + new Date().toISOString()
          );
        }}
      >
        Throw Client Error
      </Button>
    </div>
  );
}
