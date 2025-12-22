import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from './env';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';

/**
 * Creates a server-side Supabase client.
 * Automatically injects the Clerk JWT if the user is authenticated,
 * allowing Row Level Security (RLS) policies to work with Clerk users.
 */
export async function createClient() {
  const { url, anonKey } = validateEnv();
  const cookieStore = await cookies();

  let supabaseToken: string | null = null;
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      // User not authenticated - Supabase client will work with anon key
      // RLS policies will block unauthorized access
      logger.warn(
        'Creating Supabase client without auth token (unauthenticated)'
      );
    } else {
      try {
        // Try getting token with specific Supabase template first
        supabaseToken = await getToken({ template: 'supabase' });
      } catch (error) {
        logger.warn(
          'Failed to get Supabase token with template, falling back to default',
          { error }
        );
        // Fallback to default token
        try {
          supabaseToken = await getToken();
        } catch (fallbackError) {
          logger.warn('Failed to get default auth token as fallback', {
            error: fallbackError
          });
        }
      }
    }
  } catch (error) {
    logger.error('Auth check failed', { error });
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
