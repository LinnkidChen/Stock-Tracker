/**
 * @jest-environment node
 */
const originalEnv = process.env;
const mockProtect = jest.fn();
const mockCreateRouteMatcher = jest.fn((patterns: string[]) => {
  return (req: { nextUrl?: { pathname?: string }; url?: string }) => {
    const pathname = req.nextUrl?.pathname ?? new URL(req.url ?? '').pathname;

    return patterns.some((pattern) => {
      if (pattern === '/dashboard(.*)') {
        return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
      }

      return false;
    });
  };
});
const mockClerkMiddleware = jest.fn(
  (
    handler: (
      auth: { protect: typeof mockProtect },
      req: { nextUrl?: { pathname?: string }; url?: string }
    ) => Promise<void>
  ) => {
    return (req: { nextUrl?: { pathname?: string }; url?: string }) =>
      handler({ protect: mockProtect }, req);
  }
);

jest.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: mockClerkMiddleware,
  createRouteMatcher: mockCreateRouteMatcher
}));

function createRequest(pathname: string) {
  return {
    nextUrl: { pathname },
    url: `http://localhost${pathname}`
  };
}

async function loadMiddleware(env: NodeJS.ProcessEnv = {}) {
  jest.resetModules();
  mockProtect.mockClear();
  mockClerkMiddleware.mockClear();
  mockCreateRouteMatcher.mockClear();
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
    CLERK_SECRET_KEY: '',
    ...env
  };

  return import('./middleware');
}

describe('middleware', () => {
  afterAll(() => {
    process.env = originalEnv;
  });

  it('protects dashboard routes when Clerk credentials are configured', async () => {
    const { default: middleware } = await loadMiddleware({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_value',
      CLERK_SECRET_KEY: 'sk_test_value'
    });

    await middleware(createRequest('/dashboard/stocks') as never);

    expect(mockClerkMiddleware).toHaveBeenCalledTimes(1);
    expect(mockProtect).toHaveBeenCalledTimes(1);
  });

  it('does not protect public API routes when Clerk credentials are configured', async () => {
    const { default: middleware } = await loadMiddleware({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_value',
      CLERK_SECRET_KEY: 'sk_test_value'
    });

    await middleware(createRequest('/api/watchlist') as never);

    expect(mockProtect).not.toHaveBeenCalled();
  });

  it('redirects protected routes to sign-in when Clerk credentials are missing', async () => {
    const { default: middleware } = await loadMiddleware();

    const response = await middleware(
      createRequest('/dashboard/stocks') as never
    );

    expect(mockClerkMiddleware).not.toHaveBeenCalled();
    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost/auth/sign-in'
    );
  });

  it('allows public routes when Clerk credentials are missing', async () => {
    const { default: middleware } = await loadMiddleware();

    const response = await middleware(createRequest('/auth/sign-in') as never);

    expect(mockClerkMiddleware).not.toHaveBeenCalled();
    expect(response?.headers.get('x-middleware-next')).toBe('1');
  });

  it('matches app and API routes in Next middleware config', async () => {
    const { config } = await loadMiddleware();

    expect(config.matcher).toEqual([
      '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
      '/(api|trpc)(.*)'
    ]);
  });
});
