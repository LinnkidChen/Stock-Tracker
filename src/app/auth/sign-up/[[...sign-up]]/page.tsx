import { Metadata } from 'next';
import SignUpViewPage from '@/features/auth/components/sign-up-view';
import { getClerkCredentialSetup } from '@/lib/onboarding/auth-setup';

export const metadata: Metadata = {
  title: 'Authentication | Sign Up',
  description: 'Sign Up page for authentication.'
};

export default async function Page() {
  const clerkSetup = getClerkCredentialSetup();

  return <SignUpViewPage missingCredentialKeys={clerkSetup.missingKeys} />;
}
