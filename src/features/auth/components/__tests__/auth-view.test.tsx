/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import SignInViewPage from '../sign-in-view';
import SignUpViewPage from '../sign-up-view';

jest.mock('@clerk/nextjs', () => ({
  SignIn: () => <div>Mock Clerk Sign In</div>,
  SignUp: () => <div>Mock Clerk Sign Up</div>
}));

describe('auth views', () => {
  it('renders setup-required state instead of Clerk forms when credentials are missing', () => {
    const { container } = render(
      <SignInViewPage
        missingCredentialKeys={[
          'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
          'CLERK_SECRET_KEY'
        ]}
      />
    );

    expect(
      screen.getByText('Authentication setup required')
    ).toBeInTheDocument();
    expect(
      screen.getByText('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')
    ).toBeInTheDocument();
    expect(screen.getByText('CLERK_SECRET_KEY')).toBeInTheDocument();
    expect(screen.queryByText('Mock Clerk Sign In')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('sk_test_secret');
  });

  it('renders Clerk sign-in without default test email values when configured', () => {
    const { container } = render(<SignInViewPage missingCredentialKeys={[]} />);

    expect(screen.getByText('Mock Clerk Sign In')).toBeInTheDocument();
    expect(screen.getByText('Sign in to Stock Tracker')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('your_mail+clerk_test@example.com');
  });

  it('renders Clerk sign-up without default test email values when configured', () => {
    const { container } = render(<SignUpViewPage missingCredentialKeys={[]} />);

    expect(screen.getByText('Mock Clerk Sign Up')).toBeInTheDocument();
    expect(
      screen.getByText('Create your Stock Tracker account')
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent('your_mail+clerk_test@example.com');
  });
});
