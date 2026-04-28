import { AuthView } from './auth-view';
import type { ClerkCredentialKey } from '@/lib/onboarding/auth-setup';

export default function SignInViewPage({
  missingCredentialKeys
}: {
  missingCredentialKeys: ClerkCredentialKey[];
}) {
  return (
    <AuthView mode='sign-in' missingCredentialKeys={missingCredentialKeys} />
  );
}
