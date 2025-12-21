/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChartNavigation } from '../ChartNavigation';
import { useDashboardStore } from '../../store';

// Mock the store
jest.mock('../../store', () => ({
  useDashboardStore: jest.fn()
}));

describe('ChartNavigation', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('renders prompt to explore charts when no ticker is selected', () => {
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: null
    });

    render(<ChartNavigation />);

    expect(screen.getByText('Go to Charts')).toBeInTheDocument();
    expect(
      screen.getByText('Explore technical indicators and historical data')
    ).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/dashboard/charts'
    );
  });

  test('renders prompt to analyze specific ticker when ticker is selected', () => {
    (useDashboardStore as unknown as jest.Mock).mockReturnValue({
      selectedTicker: 'AAPL'
    });

    render(<ChartNavigation />);

    expect(screen.getByText('Analyze AAPL')).toBeInTheDocument();
    expect(
      screen.getByText('View advanced K-Line chart for AAPL')
    ).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/dashboard/charts?symbol=AAPL'
    );
  });
});
