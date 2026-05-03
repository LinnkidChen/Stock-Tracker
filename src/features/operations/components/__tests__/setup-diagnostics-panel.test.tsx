/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SetupDiagnosticsPanel } from '../SetupDiagnosticsPanel';
import type { SetupDiagnostics } from '@/lib/diagnostics/setup';

const diagnostics: SetupDiagnostics = {
  status: 'blocked',
  generatedAt: '2026-04-28T03:00:00.000Z',
  summary: 'Setup is blocked until required configuration is completed.',
  checks: [
    {
      id: 'clerk',
      title: 'Clerk',
      status: 'ready',
      summary: 'Authentication configuration is ready.',
      details: [
        'Required Clerk environment variables are present.',
        'Authenticated dashboard session is active.'
      ],
      remediation: null
    },
    {
      id: 'supabase',
      title: 'Supabase',
      status: 'blocked',
      summary: 'Watchlist persistence setup is incomplete.',
      details: ['Clerk JWT template "supabase" was not found.'],
      remediation:
        'Configure Supabase URL/key values and Clerk JWT template "supabase" for Clerk-issued Supabase tokens.'
    },
    {
      id: 'market-data',
      title: 'Market data',
      status: 'warning',
      summary: 'Market data credentials need review.',
      details: ['Credential verification was skipped.'],
      remediation: 'Confirm Longbridge credentials on the server.'
    }
  ]
};

describe('SetupDiagnosticsPanel', () => {
  it('renders overall status, check statuses, details, and remediation', () => {
    render(<SetupDiagnosticsPanel diagnostics={diagnostics} />);

    expect(
      screen.getByRole('heading', { name: 'Operations' })
    ).toBeInTheDocument();
    expect(screen.getByText('Overall: Blocked')).toBeInTheDocument();
    expect(
      screen.getByText('Generated 2026-04-28T03:00:00.000Z')
    ).toBeInTheDocument();
    expect(screen.getByText('Clerk')).toBeInTheDocument();
    expect(screen.getByText('Supabase')).toBeInTheDocument();
    expect(screen.getByText('Market data')).toBeInTheDocument();
    expect(
      screen.getByText('Clerk JWT template "supabase" was not found.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('Remediation')).toHaveLength(2);
  });

  it('does not render secret sentinel values that are not part of diagnostics', () => {
    const { container } = render(
      <SetupDiagnosticsPanel diagnostics={diagnostics} />
    );

    expect(container).not.toHaveTextContent('sk_test_secret');
    expect(container).not.toHaveTextContent('longbridge_access_token');
    expect(container).not.toHaveTextContent('supabase_publishable_secret');
  });
});
