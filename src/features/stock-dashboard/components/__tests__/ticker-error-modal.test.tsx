/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TickerErrorModal } from '../TickerErrorModal';

describe('TickerErrorModal', () => {
  it('renders title, description, and next step when open', async () => {
    render(
      <TickerErrorModal
        isOpen={true}
        onClose={jest.fn()}
        title='Invalid symbol'
        description='Ticker symbols must be 1-5 letters.'
        nextStep='Edit the symbol and try again.'
      />
    );

    expect(await screen.findByText('Invalid symbol')).toBeInTheDocument();
    expect(
      screen.getByText('Ticker symbols must be 1-5 letters.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Edit the symbol and try again.')
    ).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();

    render(
      <TickerErrorModal
        isOpen={true}
        onClose={onClose}
        title='Already in your watchlist'
        description='That symbol is already in your watchlist.'
        nextStep='Check your list or add a different symbol.'
      />
    );

    const closeButtons = await screen.findAllByRole('button', {
      name: 'Close'
    });
    const actionButton =
      closeButtons.find(
        (button) => button.getAttribute('data-slot') === 'button'
      ) ?? closeButtons[0];

    await user.click(actionButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
