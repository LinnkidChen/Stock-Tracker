# Frontend Quality

Run the checks that match the changed surface. The project scripts are in `package.json`.

## Standard Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Notes:

- The script is `typecheck`, not `type-check`.
- `pnpm lint` runs `eslint src`.
- `pnpm lint:strict` is available when warnings must fail the run.
- `pnpm test` runs Jest.
- `pnpm test:e2e` runs Playwright.

## Component And Hook Testing

Use React Testing Library and `user-event` for user-facing component behavior. Prefer queries by role, accessible name, and visible text.

Example from `src/features/stock-dashboard/components/__tests__/watchlist-card.test.tsx`:

```typescript
const user = userEvent.setup();
renderWithProviders(<WatchlistCard />);

expect(await screen.findByText('Build your watchlist')).toBeInTheDocument();

await user.click(screen.getByRole('button', { name: 'AAPL' }));

expect(await screen.findByText('AAPL')).toBeInTheDocument();
```

Wrap React Query components with a fresh `QueryClient` per test:

```typescript
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: 0 } }
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
  return { ...utils, queryClient };
}
```

## Mocking

- Mock `global.fetch` per test suite and restore it in `afterEach`.
- Use `jest.useRealTimers()` in cleanup when fake timers may be involved.
- Keep response builders small and typed where practical, for example `watchlistResponse(items)` and `quoteResponse()`.
- Use `expect.objectContaining({ signal: expect.any(Object) })` when asserting abortable fetch calls.

## Accessibility Checks

Before finishing UI changes:

- Inputs have labels or `aria-label`.
- Validation messages use `role='alert'` and are connected with `aria-describedby` where possible.
- Buttons and links have accessible names.
- Keyboard behavior is tested when adding shortcuts, focus management, dialogs, or autocomplete.

## Error And Empty States

Tests should cover user-visible failure paths for API-backed components. Existing `WatchlistCard` tests cover initial load failure, auth misconfiguration, empty state suggestions, and validation modal behavior. Follow that model for new states.

## Pre-Commit Checklist

- No production `any`, `@ts-ignore`, or `@ts-expect-error`.
- No leftover `console.log`.
- New client effects clean up timers, listeners, and subscriptions.
- Loading, empty, error, and success states are represented for async UI.
- New shared primitives remain feature-agnostic.
- Tests are added or updated for changed behavior.
- Run at least `pnpm lint` and `pnpm typecheck`; run targeted Jest tests for touched components/hooks.
