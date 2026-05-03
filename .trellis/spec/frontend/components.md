# Component Guidelines

This app uses Next.js App Router, React 19, TypeScript, Tailwind, Radix/shadcn UI primitives, Clerk, and feature-local client components.

## Server And Client Components

Default route files to server components. Add `'use client'` only when the component uses browser state, effects, event handlers, refs, Zustand, React Query, or browser APIs.

Examples:

- `src/app/page.tsx` is a server component that calls `auth()` from `@clerk/nextjs/server` and redirects.
- `src/features/stock-dashboard/components/DashboardClient.tsx` is a client component because it uses `useEffect`, refs, and `useDashboardStore`.
- `src/features/stock-dashboard/components/WatchlistCard.tsx` is a client component because it owns interactive form state, fetches from browser routes, and uses hooks.

Keep server route files thin and hand off interactive surfaces to feature components:

```typescript
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function Page() {
  const { userId } = await auth();

  if (!userId) {
    return redirect('/auth/sign-in');
  }

  redirect('/dashboard/stocks');
}
```

## UI Primitives

Use primitives from `src/components/ui` before creating new base controls. They follow the shadcn pattern:

- Radix `Slot` for `asChild` composition.
- `class-variance-authority` for variants.
- `cn` from `@/lib/utils` for class merging.
- Tailwind classes inline in component definitions.

Example from `src/components/ui/button.tsx`:

```typescript
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

For new shared primitives, match this API shape and keep feature behavior out of the primitive.

## Feature Components

Feature components may include local helper functions and types when those helpers only serve the component. `WatchlistCard.tsx` is an existing large example with local normalization, grouping, sorting, optimistic item creation, and display formatting helpers.

For new or heavily modified feature components:

- Keep pure helpers above the component and make them easy to test or extract later.
- Keep feature API parsing/error mapping in `features/<feature>/lib` when it is reused.
- Use explicit prop interfaces for exported components when props are non-trivial.
- Use `forwardRef` when a parent needs to control focus, as in `TickerInput`.

```typescript
interface TickerInputProps {
  onTickerSubmit?: (ticker: string) => void;
}

export const TickerInput = forwardRef<HTMLInputElement, TickerInputProps>(
  ({ onTickerSubmit }, ref) => {
    // component body
  }
);

TickerInput.displayName = 'TickerInput';
```

## Accessibility

Use semantic HTML and explicit accessibility attributes already present in the codebase:

- Forms use `<form>` and buttons use `<button type='button'>` or `<Button type='submit'>`.
- Inputs expose `aria-label`, `aria-invalid`, `aria-describedby`, and `autoComplete` where needed.
- Error messages use `role='alert'`.
- Interactive regions can use `role` and `aria-label`, as in `DashboardClient`.
- Tests should prefer role/name queries for user-visible controls.

Example from `TickerInput`:

```typescript
<Input
  aria-invalid={!!error}
  aria-autocomplete='list'
  aria-label='Enter stock ticker symbol'
  aria-describedby={error ? 'ticker-error' : undefined}
/>
```

## Styling

- Use Tailwind classes directly; keep class composition readable.
- Use app UI primitives for consistent spacing, variants, focus states, and disabled states.
- Keep layout ownership local to the component that owns the surface. For example `DashboardClient` owns the page grid, while `WatchlistCard` owns watchlist grouping and card internals.
- Prefer existing icons from `lucide-react` or installed icon libraries instead of hand-written SVG.

## Avoid

- Adding `'use client'` to route files unless the file truly needs client APIs.
- Creating bespoke buttons, dialogs, inputs, switches, or cards instead of `src/components/ui`.
- Using non-semantic clickable `div`s.
- Hiding runtime errors with broad catches in components; map known failures into explicit UI states when possible.
