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
