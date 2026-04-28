import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import type { ClerkCredentialKey } from '@/lib/onboarding/auth-setup';
import {
  SignIn as ClerkSignInForm,
  SignUp as ClerkSignUpForm
} from '@clerk/nextjs';
import {
  IconAlertTriangle,
  IconChartLine,
  IconCircleCheck
} from '@tabler/icons-react';
import Link from 'next/link';

type AuthMode = 'sign-in' | 'sign-up';

interface AuthViewProps {
  mode: AuthMode;
  missingCredentialKeys: ClerkCredentialKey[];
}

const AUTH_COPY: Record<
  AuthMode,
  {
    title: string;
    description: string;
    footer: string;
    alternateHref: string;
    alternateLabel: string;
  }
> = {
  'sign-in': {
    title: 'Sign in to Stock Tracker',
    description: 'Access your watchlist, charts, and market setup checks.',
    footer: 'Need an account?',
    alternateHref: '/auth/sign-up',
    alternateLabel: 'Create one'
  },
  'sign-up': {
    title: 'Create your Stock Tracker account',
    description: 'Start with a watchlist and guided setup diagnostics.',
    footer: 'Already have an account?',
    alternateHref: '/auth/sign-in',
    alternateLabel: 'Sign in'
  }
};

function SetupRequired({
  missingCredentialKeys
}: {
  missingCredentialKeys: ClerkCredentialKey[];
}) {
  return (
    <Card className='w-full max-w-lg'>
      <CardHeader className='space-y-3'>
        <div className='bg-destructive/10 text-destructive flex size-10 items-center justify-center rounded-lg'>
          <IconAlertTriangle aria-hidden='true' className='size-5' />
        </div>
        <div className='space-y-1'>
          <CardTitle>Authentication setup required</CardTitle>
          <CardDescription>
            Configure Clerk credentials before rendering the sign-in and sign-up
            forms.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='rounded-lg border p-3'>
          <div className='text-sm font-medium'>
            Missing environment variables
          </div>
          <ul className='text-muted-foreground mt-2 space-y-1 text-sm'>
            {missingCredentialKeys.map((key) => (
              <li key={key}>
                <code>{key}</code>
              </li>
            ))}
          </ul>
        </div>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          Add these values to your local environment, restart the app, then
          return to authentication.
        </p>
      </CardContent>
    </Card>
  );
}

function AuthSidePanel() {
  return (
    <aside className='bg-muted hidden h-full flex-col justify-between border-r p-10 lg:flex'>
      <div className='flex items-center gap-3 text-lg font-semibold'>
        <div className='bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg'>
          <IconChartLine aria-hidden='true' className='size-5' />
        </div>
        Stock Tracker
      </div>
      <div className='space-y-6'>
        <div>
          <h2 className='text-3xl font-bold tracking-normal'>
            Market tracking with setup clarity.
          </h2>
          <p className='text-muted-foreground mt-3 max-w-md text-sm leading-relaxed'>
            Sign in after Clerk is configured, then use the Operations page to
            complete Supabase and Longbridge readiness checks.
          </p>
        </div>
        <div className='grid gap-3 text-sm'>
          {[
            'Clerk protects dashboard access',
            'Supabase stores watchlists',
            'Longbridge powers market data'
          ].map((item) => (
            <div key={item} className='flex items-center gap-2'>
              <IconCircleCheck
                aria-hidden='true'
                className='size-4 text-emerald-600'
              />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function AuthView({ mode, missingCredentialKeys }: AuthViewProps) {
  const copy = AUTH_COPY[mode];
  const ClerkForm = mode === 'sign-in' ? ClerkSignInForm : ClerkSignUpForm;
  const hasMissingCredentials = missingCredentialKeys.length > 0;

  return (
    <div className='bg-background grid min-h-screen lg:grid-cols-[minmax(360px,0.9fr)_1.1fr]'>
      <AuthSidePanel />
      <main className='flex min-h-screen items-center justify-center p-6'>
        {hasMissingCredentials ? (
          <SetupRequired missingCredentialKeys={missingCredentialKeys} />
        ) : (
          <div className='flex w-full max-w-md flex-col items-center gap-6'>
            <div className='space-y-2 text-center'>
              <h1 className='text-2xl font-bold tracking-normal'>
                {copy.title}
              </h1>
              <p className='text-muted-foreground text-sm'>
                {copy.description}
              </p>
            </div>
            <ClerkForm />
            <p className='text-muted-foreground text-center text-sm'>
              {copy.footer}{' '}
              <Button asChild variant='link' className='h-auto p-0'>
                <Link href={copy.alternateHref}>{copy.alternateLabel}</Link>
              </Button>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
