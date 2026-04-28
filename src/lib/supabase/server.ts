import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from './env';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { createErrorLogContext } from '@/lib/observability/error-taxonomy';

export const SUPABASE_JWT_TEMPLATE = 'supabase';

export class SupabaseAuthConfigError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SupabaseAuthConfigError';
  }
}

export function isSupabaseAuthConfigError(
  error: unknown
): error is SupabaseAuthConfigError {
  return error instanceof SupabaseAuthConfigError;
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

/**
 * Creates a server-side Supabase client.
 * Automatically injects the Clerk JWT if the user is authenticated,
 * allowing Row Level Security (RLS) policies to work with Clerk users.
 */
export async function createClient() {
  const { url, publishableKey } = validateEnv();
  const cookieStore = await cookies();
  let userId: string | null;
  let getToken: Awaited<ReturnType<typeof auth>>['getToken'];

  try {
    ({ userId, getToken } = await auth());
  } catch (error) {
    logger.error(
      'Auth check failed',
      createErrorLogContext('UNKNOWN_ERROR', {
        error,
        operation: 'supabase.auth_check',
        errorDomain: 'auth'
      })
    );
    throw error;
  }

  let supabaseToken: string | null = null;

  if (!userId) {
    // User not authenticated - Supabase client will work with anon key
    // RLS policies will block unauthorized access
    logger.warn(
      'Creating Supabase client without auth token (unauthenticated)'
    );
  } else {
    try {
      supabaseToken = await getToken({ template: SUPABASE_JWT_TEMPLATE });
    } catch (error) {
      if (isClerkTemplateMissingError(error)) {
        logger.error(
          'Clerk Supabase JWT template is not configured',
          createErrorLogContext('RLS_AUTH_MISCONFIGURED', {
            error,
            template: SUPABASE_JWT_TEMPLATE,
            operation: 'supabase.jwt_template',
            errorDomain: 'system',
            remediation:
              'Create a Clerk JWT template named "supabase" and configure Supabase to trust Clerk-issued JWTs.'
          })
        );
        throw new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured',
          { template: SUPABASE_JWT_TEMPLATE }
        );
      }

      logger.error(
        'Failed to get Clerk Supabase JWT',
        createErrorLogContext('UNKNOWN_ERROR', {
          error,
          template: SUPABASE_JWT_TEMPLATE,
          operation: 'supabase.jwt_template',
          errorDomain: 'auth'
        })
      );
      // Only the missing-template case is treated as a configuration error.
      // Other Clerk failures should propagate to the generic 500 path instead
      // of being mislabeled as a persistent watchlist auth misconfiguration.
      throw error;
    }

    if (!supabaseToken) {
      logger.error(
        'Clerk Supabase JWT template returned no token',
        createErrorLogContext('RLS_AUTH_MISCONFIGURED', {
          userId,
          template: SUPABASE_JWT_TEMPLATE,
          operation: 'supabase.jwt_template',
          errorDomain: 'system',
          remediation:
            'Ensure the Clerk JWT template named "supabase" returns a signed token that Supabase is configured to verify.'
        })
      );
      throw new SupabaseAuthConfigError(
        'Clerk Supabase JWT template returned no token',
        { template: SUPABASE_JWT_TEMPLATE, userId }
      );
    }
  }

  return createServerClient(url, publishableKey, {
    global: {
      headers: supabaseToken ? { Authorization: `Bearer ${supabaseToken}` } : {}
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      }
    }
  });
}
