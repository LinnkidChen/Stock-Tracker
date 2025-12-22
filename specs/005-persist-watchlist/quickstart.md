# Quickstart Verification Guide

This guide describes how to verify the **watchlist persistence** implementation.

## 1. Setup

Ensure you have your `.env.local` configured with:
- Clerk keys
- Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Start the dev server:
```bash
pnpm dev
```

## 2. Verification Steps

### 2.1 Initial State
1. Open `http://localhost:3000/dashboard/stocks`.
2. Login if required.
3. Observe the "Watchlist" card.
4. It should initially show "Loading..." (or skeletons) then settle.
5. If you are a new user, it should show "No symbols yet."

### 2.2 Add Symbol
1. Enter "AAPL" in the input field.
2. Click "Add".
3. Verify "AAPL" appears in the list.
4. Verify a success log in console (if applicable) or network tab shows `POST /api/watchlist` (200 OK).

### 2.3 Persist on Refresh
1. Refresh the page.
2. Observe loading state.
3. Verify "AAPL" reappears automatically.

### 2.4 Remove Symbol
1. Click the "Remove" button next to "AAPL".
2. Verify "AAPL" disappears.
3. Refresh the page.
4. Verify "AAPL" is still gone.

### 2.5 Error Handling (Optional)
1. Stop your network or break the Supabase URL in `.env.local` (requires restart).
2. Refresh page.
3. Verify "Failed to load watchlist" error message appears in the card.
4. Try to add a symbol.
5. Verify an error modal ("Something went wrong" or "Connection issue") appears.
