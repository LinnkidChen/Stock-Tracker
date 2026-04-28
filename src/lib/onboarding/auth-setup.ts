import 'server-only';

export const CLERK_CREDENTIAL_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY'
] as const;

export type ClerkCredentialKey = (typeof CLERK_CREDENTIAL_KEYS)[number];

export interface ClerkCredentialSetup {
  isConfigured: boolean;
  missingKeys: ClerkCredentialKey[];
}

export function getMissingClerkCredentialKeys(): ClerkCredentialKey[] {
  return CLERK_CREDENTIAL_KEYS.filter((key) => !process.env[key]?.trim());
}

export function getClerkCredentialSetup(): ClerkCredentialSetup {
  const missingKeys = getMissingClerkCredentialKeys();

  return {
    isConfigured: missingKeys.length === 0,
    missingKeys
  };
}
