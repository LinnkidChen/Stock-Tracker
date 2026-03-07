/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { QuoteProviderToggle } from '../QuoteProviderToggle';
import { useDashboardStore } from '../../store';
import { CANONICAL_QUOTE_PROVIDER } from '@/lib/providers/config';

describe('QuoteProviderToggle', () => {
  beforeEach(() => {
    useDashboardStore.setState({
      quoteProvider: CANONICAL_QUOTE_PROVIDER
    });
  });

  it('shows Longbridge as the only visible provider option', () => {
    render(<QuoteProviderToggle />);

    expect(screen.getByText('Source:')).toBeInTheDocument();
    expect(screen.getByText('Longbridge')).toBeInTheDocument();
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
