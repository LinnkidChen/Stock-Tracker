/**
 * Validates and retrieves Supabase environment variables.
 * Throws an error if required variables are missing.
 */

export function validateEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)'
    );
  }

  return { url, publishableKey };
}
