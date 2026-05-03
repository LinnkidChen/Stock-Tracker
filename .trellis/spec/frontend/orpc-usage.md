# oRPC Usage

This is not an active frontend convention for the current app.

The generated Trellis scaffold included an oRPC document, but the repository's existing frontend code uses:

- Next.js route handlers under `src/app/api`
- browser `fetch`
- TanStack Query
- feature response helpers such as `readStockApiResponse`

Do not introduce oRPC client setup, oRPC generated query keys, or `@your-app/api` imports unless a future task explicitly adopts oRPC and updates this spec.

For current API guidance, read [api-integration.md](./api-integration.md).
