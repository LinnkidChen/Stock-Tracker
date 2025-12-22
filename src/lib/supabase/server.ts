import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { validateEnv } from './env';
import { auth } from '@clerk/nextjs/server';

/**
 * Creates a server-side Supabase client.
 * Automatically injects the Clerk JWT if the user is authenticated,
 * allowing Row Level Security (RLS) policies to work with Clerk users.
 */
export async function createClient() {
  const { url, anonKey } = validateEnv();
  const cookieStore = await cookies();

  // Get Clerk token to pass to Supabase
  let supabaseToken: string | undefined;
  try {
    const session = await auth();
    // According to Clerk docs for Supabase integration, we get the token with a specific template
    // If you haven't set up a template named 'supabase', you might need to.
    // However, if we just want the viewer ID for RLS, using the default token *might* work depending on RLS setup.
    // The RLS policies in the SQL file use `auth.jwt() ->> 'sub'`, so we need a JWT where 'sub' is the Clerk user ID.
    // Clerk's default JWT has 'sub' as the user ID.
    // We'll use getToken({ template: 'supabase' }) if configured, or just trust the standard one if that's the setup.
    // For this implementation, we'll try to get a token. If using standard Clerk-Supabase integration, a template is usually recommended.
    // Let's assume standard template 'supabase' for now, or fall back to default if not present.
    try {
      supabaseToken = await session.getToken({ template: 'supabase' });
    } catch (error) {
      // If the template 'supabase' is not defined in Clerk, it might throw a 404.
      // We can ignore this specific error and fall back to the default token.
      console.warn(
        'Failed to get Supabase token with template, falling back to default',
        error
      );
    }

    // Fallback: if no specific template is used, we might try the raw token,
    // but typically Supabase expects a signed JWT with its own secret unless utilizing custom auth.
    // If the provided SQL policies rely on `auth.jwt() ->> 'sub'`, Supabase needs to verify the JWT.
    // This usually implies Supabase is configured with Clerk's JWKS or a shared secret.
    // If validation fails, RLS will block access, which is safe.
    if (!supabaseToken) {
      supabaseToken = await session.getToken();
    }
  } catch (error) {
    // Auth might fail or not be available
    console.warn('Failed to get auth token', error);
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
