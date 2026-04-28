/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DashboardReadinessPanel } from '../DashboardReadinessPanel';
import type { SetupDiagnostics } from '@/lib/diagnostics/setup';

function buildDiagnostics(
  overrides: Partial<SetupDiagnostics> = {}
): SetupDiagnostics {
  return {
    status: 'blocked',
    generatedAt: '2026-04-28T03:00:00.000Z',
    summary: 'Setup is blocked.',
    checks: [
      {
        id: 'clerk',
        title: 'Clerk',
        status: 'ready',
        summary: 'Authentication configuration is ready.',
        details: [],
        remediation: null
      },
      {
        id: 'supabase',
        title: 'Supabase',
        status: 'blocked',
        summary: 'Watchlist persistence setup is incomplete.',
        details: [],
        remediation: 'Configure Supabase.'
      },
      {
        id: 'longbridge',
        title: 'Longbridge',
        status: 'warning',
        summary: 'Market data credentials need review.',
        details: [],
        remediation: 'Configure Longbridge.'
      }
    ],
    ...overrides
  };
}

describe('DashboardReadinessPanel', () => {
  it('renders Supabase and Longbridge setup guidance when checks need attention', () => {
    render(<DashboardReadinessPanel diagnostics={buildDiagnostics()} />);

    expect(screen.getByText('Finish first-run setup')).toBeInTheDocument();
    expect(screen.getByText('Supabase')).toBeInTheDocument();
    expect(screen.getByText('Longbridge')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open operations/i })
    ).toHaveAttribute('href', '/dashboard/operations');
  });

  it('does not render when Supabase and Longbridge are ready', () => {
    const readyDiagnostics = buildDiagnostics({
      status: 'ready',
      checks: buildDiagnostics().checks.map((check) => ({
        ...check,
        status: 'ready'
      }))
    });

    const { container } = render(
      <DashboardReadinessPanel diagnostics={readyDiagnostics} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
