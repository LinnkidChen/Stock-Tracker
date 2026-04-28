import { Metadata } from 'next';
import SignInViewPage from '@/features/auth/components/sign-in-view';
import { getClerkCredentialSetup } from '@/lib/onboarding/auth-setup';

export const metadata: Metadata = {
  title: 'Authentication | Sign In',
  description: 'Sign In page for authentication.'
};

export default async function Page() {
  const clerkSetup = getClerkCredentialSetup();

  return <SignInViewPage missingCredentialKeys={clerkSetup.missingKeys} />;
}
