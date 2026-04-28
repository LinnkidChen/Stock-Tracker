import 'server-only';

import { auth } from '@clerk/nextjs/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_JWT_TEMPLATE } from '@/lib/supabase/server';

export type DiagnosticStatus = 'ready' | 'warning' | 'blocked';

export type DiagnosticCheckId =
  | 'clerk'
  | 'supabase'
  | 'supabase-rls'
  | 'longbridge';

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

interface SupabaseCheckResult {
  check: SetupDiagnosticCheck;
  url: string | null;
  publishableKey: string | null;
  token: string | null;
}

interface SupabaseErrorLike {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  status?: unknown;
}

interface RlsProbeTarget {
  label: string;
  table: string;
}

interface RlsProbeClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        limit: (count: number) => Promise<{ error: unknown }>;
      };
    };
  };
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

const RLS_PROBE_TARGETS: RlsProbeTarget[] = [
  {
    label: 'watchlist items',
    table: 'stock_watchlist_items'
  },
  {
    label: 'portfolio holdings',
    table: 'stock_portfolio_holdings'
  }
];

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

function formatSupabaseError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as SupabaseErrorLike;
    const parts: string[] = [];

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      parts.push(candidate.message.trim());
    }
    if (typeof candidate.code === 'string' && candidate.code.trim()) {
      parts.push(`code ${candidate.code.trim()}`);
    }
    if (typeof candidate.hint === 'string' && candidate.hint.trim()) {
      parts.push(`hint: ${candidate.hint.trim()}`);
    }
    if (typeof candidate.details === 'string' && candidate.details.trim()) {
      parts.push(`details: ${candidate.details.trim()}`);
    }

    if (parts.length > 0) {
      return parts.join('; ');
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return 'unknown Supabase error';
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
): Promise<SupabaseCheckResult> {
  const details: string[] = [];
  const blockedReasons: string[] = [];
  const warningReasons: string[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasPublishableKey = hasEnvValue(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY'
  );
  const hasLegacyAnonKey = hasEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  let validSupabaseUrl: string | null = null;
  let publishableKey: string | null = null;
  let supabaseToken: string | null = null;

  if (!hasEnvValue('NEXT_PUBLIC_SUPABASE_URL')) {
    blockedReasons.push(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_URL.'
    );
  } else if (!isValidUrl(supabaseUrl)) {
    blockedReasons.push(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.'
    );
  } else {
    validSupabaseUrl = supabaseUrl!.trim();
    details.push('Supabase URL is present and has a valid URL shape.');
  }

  if (!hasPublishableKey && !hasLegacyAnonKey) {
    blockedReasons.push(
      'Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  } else if (hasPublishableKey) {
    publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!.trim();
    details.push('Supabase publishable key environment variable is present.');
  } else {
    publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();
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
        supabaseToken = token.trim();
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

  let check: SetupDiagnosticCheck;

  if (blockedReasons.length > 0) {
    check = {
      id: 'supabase',
      title: 'Supabase',
      status: 'blocked',
      summary: 'Supabase API configuration is incomplete.',
      details,
      remediation:
        'Configure Supabase URL/key values and Clerk JWT template "supabase" for Clerk-issued Supabase tokens.'
    };
  } else if (warningReasons.length > 0) {
    check = {
      id: 'supabase',
      title: 'Supabase',
      status: 'warning',
      summary:
        'Supabase config is present, but token verification is incomplete.',
      details,
      remediation:
        'Retry while signed in. If the warning persists, confirm Clerk can issue the Supabase JWT template.'
    };
  } else {
    check = {
      id: 'supabase',
      title: 'Supabase',
      status: 'ready',
      summary: 'Supabase API configuration is ready.',
      details,
      remediation: null
    };
  }

  return {
    check,
    url: validSupabaseUrl,
    publishableKey,
    token: supabaseToken
  };
}

async function runRlsReadProbe(
  client: RlsProbeClient,
  target: RlsProbeTarget,
  userId: string
) {
  const { error } = await client
    .from(target.table)
    .select('id')
    .eq('clerk_user_id', userId)
    .limit(1);

  return { error, target };
}

async function createSupabaseRlsCheck(
  authState: AuthState,
  supabaseResult: SupabaseCheckResult
): Promise<SetupDiagnosticCheck> {
  const details: string[] = [];
  const blockedReasons: string[] = [];
  const warningReasons: string[] = [];

  if (authState.error) {
    blockedReasons.push(
      'Clerk server authentication must succeed before RLS access can be checked.'
    );
  } else if (!authState.userId) {
    blockedReasons.push(
      'An authenticated dashboard session is required to check RLS access.'
    );
  }

  if (!supabaseResult.url || !supabaseResult.publishableKey) {
    blockedReasons.push(
      'Valid Supabase URL and publishable key configuration are required before RLS access can be checked.'
    );
  }

  if (!supabaseResult.token) {
    const reason =
      'A Clerk Supabase JWT token is required before RLS access can be checked.';

    if (supabaseResult.check.status === 'warning') {
      warningReasons.push(reason);
    } else {
      blockedReasons.push(reason);
    }
  }

  details.push(...blockedReasons, ...warningReasons);

  if (blockedReasons.length > 0) {
    return {
      id: 'supabase-rls',
      title: 'Supabase RLS',
      status: 'blocked',
      summary: 'RLS policy access could not be checked.',
      details,
      remediation:
        'Resolve the Clerk and Supabase configuration blockers first, then rerun the Operations checklist.'
    };
  }

  if (warningReasons.length > 0) {
    return {
      id: 'supabase-rls',
      title: 'Supabase RLS',
      status: 'warning',
      summary: 'RLS policy access was skipped.',
      details,
      remediation:
        'Retry while signed in. If the warning persists, confirm Clerk can issue the Supabase JWT template.'
    };
  }

  try {
    const client = createSupabaseClient(
      supabaseResult.url!,
      supabaseResult.publishableKey!,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: `Bearer ${supabaseResult.token!}`
          }
        }
      }
    ) as unknown as RlsProbeClient;
    const probeResults = await Promise.all(
      RLS_PROBE_TARGETS.map((target) =>
        runRlsReadProbe(client, target, authState.userId!)
      )
    );
    const failedResults = probeResults.filter((result) => result.error);

    probeResults.forEach((result) => {
      if (result.error) {
        details.push(
          `Read-only RLS probe failed for ${result.target.label}: ${formatSupabaseError(result.error)}.`
        );
      } else {
        details.push(
          `Read-only RLS probe succeeded for ${result.target.label}.`
        );
      }
    });

    if (failedResults.length > 0) {
      return {
        id: 'supabase-rls',
        title: 'Supabase RLS',
        status: 'blocked',
        summary: 'RLS policy access is failing.',
        details,
        remediation:
          'Apply database_schema/watchlist.sql and database_schema/portfolio.sql, enable RLS, and confirm Supabase JWT verification maps Clerk sub claims to clerk_user_id policies.'
      };
    }

    return {
      id: 'supabase-rls',
      title: 'Supabase RLS',
      status: 'ready',
      summary: 'RLS-protected watchlist and portfolio tables are reachable.',
      details,
      remediation: null
    };
  } catch (error) {
    return {
      id: 'supabase-rls',
      title: 'Supabase RLS',
      status: 'blocked',
      summary: 'RLS policy access check failed before completion.',
      details: [
        `Supabase RLS probe could not complete: ${formatSupabaseError(error)}.`
      ],
      remediation:
        'Confirm Supabase is reachable from the server, then rerun the Operations checklist.'
    };
  }
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
  const supabaseResult = await createSupabaseCheck(authState);
  const checks = [
    createClerkCheck(authState),
    supabaseResult.check,
    await createSupabaseRlsCheck(authState, supabaseResult),
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
