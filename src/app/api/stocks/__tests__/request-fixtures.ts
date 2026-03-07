import type { NextRequest } from 'next/server';

/**
 * Type definition for Next.js App Router dynamic route params
 * In Next.js 15+, params is a Promise
 */
export type RouteParams = {
  params: Promise<{
    symbol: string;
    [key: string]: string | string[] | undefined;
  }>;
};

/**
 * Creates a mock NextRequest instance for testing
 */
export function createMockRequest(
  url: string = 'http://localhost:3000/api/stocks/quote/AAPL',
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    query?: Record<string, string>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { method = 'GET', query, headers } = options;

  // Handle relative URLs
  const baseUrl = 'http://localhost:3000';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  const urlObj = new URL(fullUrl);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        urlObj.searchParams.set(key, value);
      }
    });
  }

  // Return a mock object that satisfies the NextRequest interface requirements for our tests
  // We avoid new NextRequest() because it conflicts with the global Request mock in test-setup.ts
  const mockHeaders = new Headers(headers);

  return {
    url: urlObj.toString(),
    nextUrl: urlObj,
    method,
    headers: mockHeaders,
    // Add other methods if needed by code under test
    clone: () => {
      throw new Error('Not implemented');
    },
    cookies: { getAll: () => [], get: () => undefined },
    geo: {},
    ip: '127.0.0.1'
  } as unknown as NextRequest;
}

/**
 * Creates mock params for dynamic routes
 */
export function createMockParams(symbol: string): RouteParams {
  return {
    params: Promise.resolve({ symbol })
  };
}

// Dummy test to prevent Jest from complaining about empty test file
if (process.env.NODE_ENV === 'test') {
  it('request-fixtures is a utility file', () => {
    expect(true).toBe(true);
  });
}
