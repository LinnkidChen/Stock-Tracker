import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from './env';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';

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
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 404
  );
}

/**
 * Creates a server-side Supabase client.
 * Automatically injects the Clerk JWT if the user is authenticated,
 * allowing Row Level Security (RLS) policies to work with Clerk users.
 */
export async function createClient() {
  const { url, anonKey } = validateEnv();
  const cookieStore = await cookies();
  const { userId, getToken } = await auth();

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
        logger.error('Clerk Supabase JWT template is not configured', {
          error,
          template: SUPABASE_JWT_TEMPLATE,
          remediation:
            'Create a Clerk JWT template named "supabase" and configure Supabase to trust Clerk-issued JWTs.'
        });
        throw new SupabaseAuthConfigError(
          'Clerk Supabase JWT template is not configured',
          { template: SUPABASE_JWT_TEMPLATE }
        );
      }

      logger.error('Failed to get Clerk Supabase JWT', {
        error,
        template: SUPABASE_JWT_TEMPLATE
      });
      throw error;
    }

    if (!supabaseToken) {
      logger.error('Clerk Supabase JWT template returned no token', {
        userId,
        template: SUPABASE_JWT_TEMPLATE,
        remediation:
          'Ensure the Clerk JWT template named "supabase" returns a signed token that Supabase is configured to verify.'
      });
      throw new SupabaseAuthConfigError(
        'Clerk Supabase JWT template returned no token',
        { template: SUPABASE_JWT_TEMPLATE, userId }
      );
    }
  }

  return createServerClient(url, anonKey, {
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
