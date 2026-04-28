import { AuthView } from './auth-view';
import type { ClerkCredentialKey } from '@/lib/onboarding/auth-setup';

export default function SignUpViewPage({
  missingCredentialKeys
}: {
  missingCredentialKeys: ClerkCredentialKey[];
}) {
  return (
    <AuthView mode='sign-up' missingCredentialKeys={missingCredentialKeys} />
  );
}
