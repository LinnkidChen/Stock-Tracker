# Repository Guidelines

## Project Structure & Module Organization

- Source code: `src/` using Next.js App Router (`src/app/...`).
- UI components: `src/components/` (design system under `src/components/ui`).
- Feature modules: `src/features/*` (e.g., `overview`, `kanban`, `products`).
- Utilities and types: `src/lib/*`, `src/types/*`.
- Config: `next.config.ts`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc`.
- Public assets: `public/`.
- Environment template: `env.example.txt` (copy to `.env`).

## Build, Test, and Development Commands

- Dev server: `pnpm dev` (Next.js with Turbopack).
- Production build: `pnpm build`.
- Start production server: `pnpm start`.
- Lint: `pnpm lint` | Fix + format: `pnpm lint:fix`.
- Format only: `pnpm format` | Check: `pnpm format:check`.
- Git hooks: pre-commit runs Prettier via `lint-staged`; pre-push runs `pnpm build`.

## Coding Style & Naming Conventions

- Language: TypeScript/TSX; 2‑space indent; semicolons; single quotes; LF EOL (enforced by Prettier).
- Linting: Next + TypeScript rules; `no-console` and unused vars warn.
- File/folder names: kebab-case (e.g., `user-avatar-profile.tsx`).
- Components: PascalCase for React components; hooks start with `use...`.
- Types/interfaces: PascalCase in `src/types` or colocated.
- Tailwind: prefer utility classes; plugin `prettier-plugin-tailwindcss` orders classes.

## Testing Guidelines

- No formal test setup in this repo yet. If adding tests:
  - Use Vitest + React Testing Library.
  - Name tests `*.test.ts` / `*.test.tsx` near source or in `__tests__/`.
  - Add a `test` script in `package.json` and run via `pnpm test`.

## Commit & Pull Request Guidelines

- Commits: keep small and scoped; prefer Conventional Commits (e.g., `feat: add stocks API route`).
- Include context in body (what/why), not just code changes.
- PRs: provide a clear description, screenshots for UI changes, and reference issues (e.g., `Closes #123`).
- Ensure `pnpm lint` and `pnpm build` pass locally; avoid committing `.env`.

## Security & Configuration Tips

- Auth: Clerk supports keyless mode; keys are optional to start. Set `NEXT_PUBLIC_CLERK_*` and `CLERK_SECRET_KEY` when ready.
- Error tracking: Sentry supported; configure `NEXT_PUBLIC_SENTRY_*` and `SENTRY_AUTH_TOKEN` for source maps.
- Never commit secrets. Copy `env.example.txt` to `.env` and fill values locally.

## Agent-Specific Instructions

- Planning: always use spec-workflow MCP to plan (see `.spec-workflow/*`).
- Output: always produce content that is concise, simple, and readable.

These examples should be used as guidance when configuring Sentry functionality within a project.

# Exception Catching

Use `Sentry.captureException(error)` to capture an exception and log the error in Sentry.
Use this in try catch blocks or areas where exceptions are expected

# Tracing Examples

Spans should be created for meaningful actions within an applications like button clicks, API calls, and function calls
Use the `Sentry.startSpan` function to create a span
Child spans can exist within a parent span

## Custom Span instrumentation in component actions

The `name` and `op` properties should be meaninful for the activities in the call.
Attach attributes based on relevant information and metrics from the request

```javascript
function TestComponent() {
  const handleTestButtonClick = () => {
    // Create a transaction/span to measure performance
    Sentry.startSpan(
      {
        op: "ui.click",
        name: "Test Button Click",
      },
      (span) => {
        const value = "some config";
        const metric = "some metric";

        // Metrics can be added to the span
        span.setAttribute("config", value);
        span.setAttribute("metric", metric);

        doSomething();
      },
    );
  };

  return (
    <button type="button" onClick={handleTestButtonClick}>
      Test Sentry
    </button>
  );
}
```

## Custom span instrumentation in API calls

The `name` and `op` properties should be meaninful for the activities in the call.
Attach attributes based on relevant information and metrics from the request

```javascript
async function fetchUserData(userId) {
  return Sentry.startSpan(
    {
      op: "http.client",
      name: `GET /api/users/${userId}`,
    },
    async () => {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      return data;
    },
  );
}
```

# Logs

Where logs are used, ensure Sentry is imported using `import * as Sentry from "@sentry/nextjs"`
Enable logging in Sentry using `Sentry.init({  enableLogs: true })`
Reference the logger using `const { logger } = Sentry`
Sentry offers a consoleLoggingIntegration that can be used to log specific console error types automatically without instrumenting the individual logger calls

## Configuration

In NextJS the client side Sentry initialization is in `instrumentation-client.(js|ts)`, the server initialization is in `sentry.server.config.ts` and the edge initialization is in `sentry.edge.config.ts`
Initialization does not need to be repeated in other files, it only needs to happen the files mentioned above. You should use `import * as Sentry from "@sentry/nextjs"` to reference Sentry functionality

### Baseline

```javascript
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: <dsn value>,

  enableLogs: true,
});
```

### Logger Integration

```javascript
Sentry.init({
  dsn: <dsn value>,
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
});
```

## Logger Examples

`logger.fmt` is a template literal function that should be used to bring variables into the structured logs.

```javascript
logger.trace("Starting database connection", { database: "users" });
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
logger.info("Updated profile", { profileId: 345 });
logger.warn("Rate limit reached for endpoint", {
  endpoint: "/api/results/",
  isEnterprise: false,
});
logger.error("Failed to process payment", {
  orderId: "order_123",
  amount: 99.99,
});
logger.fatal("Database connection pool exhausted", {
  database: "users",
  activeConnections: 100,
});
```