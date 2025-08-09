This file provides guidance to Claude Code when working with the my-stock website repository.

## Project Overview

My-Stock is a stock analysis and portfolio management platform built with Next.js. It provides real-time market data, portfolio tracking, technical analysis tools, and investment insights for individual investors.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **UI**: Shadcn/ui components + Tailwind CSS
- **State**: React Server Components + Client hooks
- **React**: v19 RC
- **Package Manager**: pnpm

## Project Structure

```
/app/                    # Next.js App Router
  /(auth)/              # Authentication routes
  /(dashboard)/         # Protected app routes
  /api/                 # API endpoints
/components/            # Reusable components
  /ui/                  # Shadcn components
  /charts/              # Financial charts
  /stock/               # Stock components
  /portfolio/           # Portfolio components
/lib/                   # Utilities
  /api/                 # API clients
  /hooks/               # Custom hooks
  /types/               # TypeScript types
  /utils/               # Helper functions
/services/              # External integrations
```

## Key Concepts

### Data Fetching
- Use Server Components for initial data loading
- Implement streaming for real-time prices
- Cache frequently accessed data
- Handle API rate limits gracefully

### Component Patterns
- Default to Server Components
- Use 'use client' only when needed (interactivity, hooks)
- Implement proper loading and error states
- Use Suspense boundaries for async operations

### Financial Data Handling
- Validate stock symbols (1-5 uppercase letters)
- Use proper decimal precision (2-4 places)
- Display timestamps for all price data
- Show clear gain/loss indicators (green/red)

### API Design
- RESTful endpoints under /api/
- Implement proper error responses
- Use TypeScript for request/response validation
- Consider rate limiting for external API calls

## Commands

```bash
pnpm dev          # Development server
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm prettier     # Format code
pnpm type-check   # TypeScript checking
```

## Important Considerations

### Security
- Never expose API keys in client code
- Validate all financial inputs server-side
- Implement authentication middleware
- Use environment variables for sensitive data

### Performance
- Implement virtual scrolling for large lists
- Lazy load heavy chart libraries
- Use ISR for relatively stable data
- Optimize real-time updates

### User Experience
- Show loading skeletons for async data
- Provide clear error messages
- Implement optimistic updates
- Ensure mobile responsiveness

### Accessibility
- Use semantic HTML
- Provide ARIA labels
- Ensure keyboard navigation
- Maintain proper color contrast

## Development Workflow

1. Check TypeScript types before committing
2. Test with various market conditions (open/closed)
3. Verify calculations for accuracy
4. Consider timezone handling for global markets
5. Test on multiple devices and screen sizes

## Environment Variables

Required variables in `.env.local`:
- Stock API credentials
- Database connection
- Authentication secrets
- Feature flags

## Common Patterns

- **Route Groups**: Use (auth) and (dashboard) for layout organization
- **API Routes**: Implement under app/api/ with proper error handling
- **Real-time Data**: Use Server-Sent Events or WebSockets
- **Caching**: Leverage Next.js caching with appropriate revalidation
- **State Management**: Server state by default, client state for interactivity

Remember: Accuracy, security, and performance are critical when handling financial data. Always validate inputs, handle errors gracefully, and provide clear feedback to users.
