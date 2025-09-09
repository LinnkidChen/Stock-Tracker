# Tasks Document

## Implementation Tasks for Watchlist Live Data Feature

- [ ] 1. Create extended watchlist types in src/types/stocks.ts
  - File: src/types/stocks.ts
  - Add WatchlistItemWithPrice interface extending WatchlistItem
  - Add WatchlistPricesMap type for price data storage
  - Add PriceDisplayConfig interface for display settings
  - Purpose: Establish type safety for watchlist with price data
  - _Leverage: Existing WatchlistItem, StockQuote types_
  - _Requirements: 1.1, 3.1_

- [ ] 2. Create PriceIndicator component in src/features/stock-dashboard/components/PriceIndicator.tsx
  - File: src/features/stock-dashboard/components/PriceIndicator.tsx
  - Implement price display with color-coded changes (green/red)
  - Add directional arrow indicators (up/down)
  - Format numbers with proper precision
  - Purpose: Reusable component for displaying price changes
  - _Leverage: Tailwind CSS utilities, existing formatting utils_
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Create LoadingSkeleton component in src/features/stock-dashboard/components/LoadingSkeleton.tsx
  - File: src/features/stock-dashboard/components/LoadingSkeleton.tsx
  - Implement skeleton loader with Tailwind animations
  - Accept count prop for multiple skeleton items
  - Match watchlist item layout dimensions
  - Purpose: Provide loading state visualization
  - _Leverage: Tailwind animation utilities_
  - _Requirements: 5.1, 5.2_

- [ ] 4. Create useWatchlistPrices hook in src/features/stock-dashboard/hooks/useWatchlistPrices.ts
  - File: src/features/stock-dashboard/hooks/useWatchlistPrices.ts
  - Implement batch fetching for multiple symbols
  - Utilize React Query for caching with 5-minute stale time
  - Handle individual symbol failures gracefully
  - Purpose: Manage fetching and caching of multiple stock quotes
  - _Leverage: useStockQuote hook, React Query_
  - _Requirements: 1.1, 2.1, 2.2, 2.4_

- [ ] 5. Create WatchlistItemDisplay component in src/features/stock-dashboard/components/WatchlistItemDisplay.tsx
  - File: src/features/stock-dashboard/components/WatchlistItemDisplay.tsx
  - Display symbol with price data from props
  - Show loading state or error message when appropriate
  - Include remove button with existing mutate function
  - Purpose: Display individual watchlist item with live price
  - _Leverage: PriceIndicator component, Button from UI library_
  - _Requirements: 1.2, 3.1, 4.1_

- [ ] 6. Update WatchlistCard component to integrate live prices
  - File: src/features/stock-dashboard/components/WatchlistCard.tsx
  - Replace mock data initialization with empty array
  - Integrate useWatchlistPrices hook for price fetching
  - Replace inline list items with WatchlistItemDisplay components
  - Add LoadingSkeleton for initial load state
  - Purpose: Main component orchestrating watchlist with live data
  - _Leverage: useWatchlistPrices, WatchlistItemDisplay, LoadingSkeleton_
  - _Requirements: 1.1, 1.3, 2.1, 5.1_

- [ ] 7. Add error handling utilities in src/features/stock-dashboard/utils/error-handlers.ts
  - File: src/features/stock-dashboard/utils/error-handlers.ts
  - Create handleStockFetchError function for API errors
  - Add isRateLimitError detection function
  - Implement error message formatting for user display
  - Purpose: Centralized error handling for stock data fetching
  - _Leverage: APIError types, existing error utilities_
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 8. Create price formatting utilities in src/features/stock-dashboard/utils/price-formatters.ts
  - File: src/features/stock-dashboard/utils/price-formatters.ts
  - Implement formatPrice function with precision control
  - Add formatChange function for +/- display
  - Create formatPercentage function with % suffix
  - Purpose: Consistent price and change formatting
  - _Leverage: Existing number formatting utilities_
  - _Requirements: 3.1, 3.2_

- [ ] 9. Add unit tests for PriceIndicator component
  - File: src/features/stock-dashboard/components/__tests__/PriceIndicator.test.tsx
  - Test positive price change displays in green
  - Test negative price change displays in red
  - Test zero change displays neutral
  - Verify proper number formatting
  - Purpose: Ensure price indicator behaves correctly
  - _Leverage: React Testing Library, existing test utilities_
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 10. Add unit tests for useWatchlistPrices hook
  - File: src/features/stock-dashboard/hooks/__tests__/useWatchlistPrices.test.tsx
  - Test successful batch fetching
  - Test handling of individual symbol failures
  - Test cache behavior and stale time
  - Verify cleanup on unmount
  - Purpose: Ensure reliable data fetching behavior
  - _Leverage: React Query test utilities, MSW for mocking_
  - _Requirements: 2.1, 2.2, 4.1_

- [ ] 11. Add integration tests for WatchlistCard with live data
  - File: src/features/stock-dashboard/components/__tests__/WatchlistCard.integration.test.tsx
  - Test full flow from empty to populated watchlist
  - Test adding symbol and seeing price appear
  - Test error states with failed API calls
  - Verify loading states display correctly
  - Purpose: Ensure complete feature works end-to-end
  - _Leverage: MSW for API mocking, React Testing Library_
  - _Requirements: 1.1, 1.3, 4.1, 5.1_

- [ ] 12. Update existing watchlist API types for consistency
  - File: src/app/api/watchlist/route.ts
  - Add type exports for watchlist response
  - Ensure consistency with new WatchlistItemWithPrice type
  - Update JSDoc comments for clarity
  - Purpose: Maintain API contract consistency
  - _Leverage: Existing validation utilities_
  - _Requirements: 1.1, 2.1_

- [ ] 13. Add performance monitoring for batch requests
  - File: src/features/stock-dashboard/utils/performance.ts
  - Implement timing measurements for batch fetches
  - Add console warnings for slow requests (>3s)
  - Create performance metrics collection
  - Purpose: Monitor and optimize performance
  - _Leverage: Browser Performance API_
  - _Requirements: Performance requirements_

- [ ] 14. Create storybook stories for new components
  - File: src/features/stock-dashboard/components/PriceIndicator.stories.tsx
  - Add stories for different price change scenarios
  - Include loading and error states
  - Document component props and usage
  - Purpose: Component documentation and visual testing
  - _Leverage: Storybook setup if available_
  - _Requirements: 3.1, 5.1_

- [ ] 15. Final integration testing and cleanup
  - File: Multiple files
  - Run full test suite to ensure no regressions
  - Remove unused mock data imports
  - Update component documentation
  - Verify TypeScript types are consistent
  - Purpose: Ensure production readiness
  - _Leverage: Existing test infrastructure_
  - _Requirements: All_