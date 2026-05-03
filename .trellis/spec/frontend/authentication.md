# Frontend Authentication

This project uses Clerk, not better-auth. Follow the existing Clerk patterns in route gates, auth UI, and API route handlers.

## Server Route Gates

Use `auth()` from `@clerk/nextjs/server` in server components and route handlers.

Example from `src/app/page.tsx`:

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

## Auth UI

Auth pages render feature components under `src/features/auth/components`. Use Clerk's provided forms when credentials are configured.

Example from `AuthView`:

```typescript
import {
  SignIn as ClerkSignInForm,
  SignUp as ClerkSignUpForm
} from '@clerk/nextjs';

const ClerkForm = mode === 'sign-in' ? ClerkSignInForm : ClerkSignUpForm;

return hasMissingCredentials ? (
  <SetupRequired missingCredentialKeys={missingCredentialKeys} />
) : (
  <ClerkForm />
);
```

## Setup Diagnostics

Auth setup can be incomplete in local environments. Use the existing onboarding helpers and show actionable UI instead of rendering broken auth forms.

- `src/lib/onboarding/auth-setup.ts` defines Clerk credential checks.
- `AuthView` renders `SetupRequired` when Clerk variables are missing.
- Copy should point users to configure Clerk credentials and restart the app.

## API Routes

Protected route handlers call `auth()` and return explicit JSON errors.

Example from `src/app/api/watchlist/route.ts`:

```typescript
export async function GET(req: Request) {
  const { userId } = await auth();
  const rateLimitResponse = await enforceWatchlistRateLimit(req, userId);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  if (!userId) {
    return NextResponse.json(
      { success: false, error: { message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  const items = await getWatchlistItems(userId);
  return createWatchlistResponse(items);
}
```

## Avoid

- Adding better-auth client/server imports.
- Storing Clerk secrets or session data in localStorage.
- Rendering Clerk forms before required credentials are present.
- Returning vague auth failures from API routes when a specific setup error can be detected.
