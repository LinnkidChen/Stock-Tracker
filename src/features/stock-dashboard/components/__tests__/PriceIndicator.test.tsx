/**
 * @jest-environment jsdom
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { PriceIndicator } from '../PriceIndicator';

function render(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return { container, unmount: () => root.unmount() };
}

describe('PriceIndicator', () => {
  it('renders positive change in green with up arrow and formatted values', () => {
    const { container, unmount } = render(
      <PriceIndicator price={123.45} change={1.23} changePercent={1.23} />
    );

    // Price formatted with 2 decimals and dollar sign
    expect(container.textContent).toContain('$123.45');

    // Change formatted with + sign and percent in parentheses
    expect(container.textContent).toContain('+1.23 (+1.23%)');

    // Positive styling
    const positiveEl = container.querySelector('div.text-green-600');
    expect(positiveEl).not.toBeNull();

    // Up arrow icon from lucide-react
    const upIcon = container.querySelector('svg.lucide.lucide-arrow-up');
    expect(upIcon).not.toBeNull();

    unmount();
  });

  it('renders negative change in red with down arrow and formatted values', () => {
    const { container, unmount } = render(
      <PriceIndicator price={200} change={-2.5} changePercent={-1.25} />
    );

    // Price formatted
    expect(container.textContent).toContain('$200.00');

    // Change shows absolute value (design choice) and percent
    expect(container.textContent).toContain('2.50 (1.25%)');

    // Negative styling
    const negativeEl = container.querySelector('div.text-red-600');
    expect(negativeEl).not.toBeNull();

    // Down arrow icon from lucide-react
    const downIcon = container.querySelector('svg.lucide.lucide-arrow-down');
    expect(downIcon).not.toBeNull();

    unmount();
  });

  it('treats zero change as non-negative (green) and shows up arrow', () => {
    const { container, unmount } = render(
      <PriceIndicator price={50} change={0} changePercent={0} />
    );

    // Zero treated as positive per implementation (>= 0)
    const positiveEl = container.querySelector('div.text-green-600');
    expect(positiveEl).not.toBeNull();

    // Up arrow present
    const upIcon = container.querySelector('svg.lucide.lucide-arrow-up');
    expect(upIcon).not.toBeNull();

    // Formatting for zero
    expect(container.textContent).toContain('+0.00 (+0.00%)');

    unmount();
  });

  it('respects showPercent=false (no percent shown)', () => {
    const { container, unmount } = render(
      <PriceIndicator
        price={100}
        change={5}
        changePercent={5}
        showPercent={false}
      />
    );

    // No percent shown, only numeric change with sign
    expect(container.textContent).toContain('+5.00');
    expect(container.textContent).not.toContain('%');

    unmount();
  });
});
