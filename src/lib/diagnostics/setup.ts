import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { SUPABASE_JWT_TEMPLATE } from '@/lib/supabase/server';

export type DiagnosticStatus = 'ready' | 'warning' | 'blocked';

export type DiagnosticCheckId = 'clerk' | 'supabase' | 'longbridge';

export interface SetupDiagnosticCheck {
  id: DiagnosticCheckId;
  title: string;
  status: DiagnosticStatus;
  summary: string;
  details: string[];
  remediation: string | null;
}

export interface SetupDiagnostics {
  status: DiagnosticStatus;
  generatedAt: string;
  summary: string;
  checks: SetupDiagnosticCheck[];
}

interface AuthState {
  userId: string | null;
  getToken?: (options: { template: string }) => Promise<string | null>;
  error?: unknown;
}

const CLERK_ENV_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY'
] as const;

const LONGBRIDGE_ENV_KEYS = [
  'LONGPORT_APP_KEY',
  'LONGPORT_APP_SECRET',
  'LONGPORT_ACCESS_TOKEN'
] as const;

function hasEnvValue(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

function getMissingEnvKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => !hasEnvValue(key));
}

function isValidUrl(value: string | undefined): boolean {
  if (!value?.trim()) {
    return false;
  }

  try {
    const url = new URL(value);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}

function isClerkTemplateMissingError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    status?: unknown;
    clerkError?: unknown;
    code?: unknown;
    message?: unknown;
  };

  return (
    candidate.clerkError === true &&
    candidate.status === 404 &&
    (candidate.code === 'api_response_error' ||
      (typeof candidate.message === 'string' &&
        candidate.message.toLowerCase().includes('not found')))
  );
}

function joinKeys(keys: string[]): string {
  return keys.join(', ');
}

function createClerkCheck(authState: AuthState): SetupDiagnosticCheck {
  const missingKeys = getMissingEnvKeys(CLERK_ENV_KEYS);
  const details: string[] = [];

  if (missingKeys.length > 0) {
    details.push(`Missing environment variables: ${joinKeys(missingKeys)}.`);
  } else {
    details.push('Required Clerk environment variables are present.');
  }

  if (authState.error) {
    details.push('Clerk server authentication could not be evaluated.');
  } else if (!authState.userId) {
    details.push('No authenticated dashboard session was found.');
  } else {
    details.push('Authenticated dashboard session is active.');
  }

  if (missingKeys.length > 0 || authState.error || !authState.userId) {
    return {
      id: 'clerk',
      title: 'Clerk',
      status: 'blocked',
      summary: 'Authentication setup needs attention.',
      details,
      remediation:
        'Configure Clerk publishable and secret keys, then sign in to the dashboard again.'
    };
  }

  return {
    id: 'clerk',
    title: 'Clerk',
    status: 'ready',
    summary: 'Authentication configuration is ready.',
    details,
    remediation: null
  };
}

async function createSupabaseCheck(
  authState: AuthState
): Promise<SetupDiagnosticCheck> {
  const details: string[] = [];
  const blockedReasons: string[] = [];
  const warningReasons: string[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasPublishableKey = hasEnvValue(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
  );
  const hasLegacyAnonKey = hasEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!hasEnvValue('NEXT_PUBLIC_SUPABASE_URL')) {
    blockedReasons.push(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL.'
    );
  } else if (!isValidUrl(supabaseUrl)) {
    blockedReasons.push(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.'
    );
  } else {
    details.push('Supabase URL is present and has a valid URL shape.');
  }

  if (!hasPublishableKey && !hasLegacyAnonKey) {
    blockedReasons.push(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  } else if (hasPublishableKey) {
    details.push('Supabase publishable key environment variable is present.');
  } else {
    details.push('Using legacy Supabase anon key environment variable.');
  }

  if (authState.error) {
    warningReasons.push(
      'Clerk auth failed before the Supabase JWT template could be checked.'
    );
  } else if (!authState.userId || !authState.getToken) {
    warningReasons.push(
      'No authenticated Clerk session is available to verify the Supabase JWT template.'
    );
  } else {
    try {
      const token = await authState.getToken({
        template: SUPABASE_JWT_TEMPLATE
      });

      if (token?.trim()) {
        details.push(
          `Clerk JWT template "${SUPABASE_JWT_TEMPLATE}" returned a token.`
        );
      } else {
        blockedReasons.push(
          `Clerk JWT template "${SUPABASE_JWT_TEMPLATE}" returned no token.`
        );
      }
    } catch (error) {
      if (isClerkTemplateMissingError(error)) {
        blockedReasons.push(
          `Clerk JWT template "${SUPABASE_JWT_TEMPLATE}" was not found.`
        );
      } else {
        warningReasons.push(
          `Clerk JWT template "${SUPABASE_JWT_TEMPLATE}" could not be verified.`
        );
      }
    }
  }

  details.push(...blockedReasons, ...warningReasons);

  if (blockedReasons.length > 0) {
    return {
      id: 'supabase',
      title: 'Supabase',
      status: 'blocked',
      summary: 'Watchlist persistence setup is incomplete.',
      details,
      remediation:
        'Configure Supabase URL/key values and Clerk JWT template "supabase" for Clerk-issued Supabase tokens.'
    };
  }

  if (warningReasons.length > 0) {
    return {
      id: 'supabase',
      title: 'Supabase',
      status: 'warning',
      summary:
        'Supabase config is present, but token verification is incomplete.',
      details,
      remediation:
        'Retry while signed in. If the warning persists, confirm Clerk can issue the Supabase JWT template.'
    };
  }

  return {
    id: 'supabase',
    title: 'Supabase',
    status: 'ready',
    summary: 'Watchlist persistence configuration is ready.',
    details,
    remediation: null
  };
}

function createLongbridgeCheck(): SetupDiagnosticCheck {
  const missingKeys = getMissingEnvKeys(LONGBRIDGE_ENV_KEYS);
  const details =
    missingKeys.length > 0
      ? [`Missing environment variables: ${joinKeys(missingKeys)}.`]
      : ['Required Longbridge environment variables are present.'];

  if (missingKeys.length > 0) {
    return {
      id: 'longbridge',
      title: 'Longbridge',
      status: 'blocked',
      summary: 'Market data credentials are incomplete.',
      details,
      remediation:
        'Configure Longbridge app key, app secret, and access token on the server.'
    };
  }

  return {
    id: 'longbridge',
    title: 'Longbridge',
    status: 'ready',
    summary: 'Market data credentials are configured.',
    details,
    remediation: null
  };
}

function getOverallStatus(checks: SetupDiagnosticCheck[]): DiagnosticStatus {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked';
  }

  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }

  return 'ready';
}

function getOverallSummary(status: DiagnosticStatus): string {
  switch (status) {
    case 'ready':
      return 'All setup checks are ready.';
    case 'warning':
      return 'Setup is mostly ready, with one check needing review.';
    case 'blocked':
      return 'Setup is blocked until required configuration is completed.';
    default:
      return 'Setup diagnostics completed.';
  }
}

async function getAuthState(): Promise<AuthState> {
  try {
    const authResult = await auth();
    return {
      userId: authResult.userId,
      getToken: authResult.getToken
    };
  } catch (error) {
    return {
      userId: null,
      error
    };
  }
}

export async function getSetupDiagnostics(): Promise<SetupDiagnostics> {
  const authState = await getAuthState();
  const checks = [
    createClerkCheck(authState),
    await createSupabaseCheck(authState),
    createLongbridgeCheck()
  ];
  const status = getOverallStatus(checks);

  return {
    status,
    generatedAt: new Date().toISOString(),
    summary: getOverallSummary(status),
    checks
  };
}
