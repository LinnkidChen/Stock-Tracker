/**
 * @jest-environment node
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import {
  createClient,
  SupabaseAuthConfigError,
  SUPABASE_JWT_TEMPLATE
} from './server';

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn()
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn()
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

describe('createClient', () => {
  const mockCreateServerClient = createServerClient as jest.Mock;
  const mockCookies = cookies as jest.Mock;
  const mockAuth = auth as jest.Mock;
  const mockLogger = logger as {
    error: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
      'publishable-key';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    mockCookies.mockResolvedValue({
      getAll: jest.fn(() => []),
      set: jest.fn()
    });

    mockCreateServerClient.mockReturnValue({ kind: 'supabase-client' });
  });

  it('creates an unauthenticated client without an authorization header', async () => {
    mockAuth.mockResolvedValue({ userId: null, getToken: jest.fn() });

    const client = await createClient();

    expect(client).toEqual({ kind: 'supabase-client' });
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      expect.objectContaining({
        global: { headers: {} },
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function)
        })
      })
    );
  });

  it('uses the Clerk supabase JWT template for authenticated requests', async () => {
    const getToken = jest.fn().mockResolvedValue('supabase-jwt');
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    await createClient();

    expect(getToken).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledWith({ template: SUPABASE_JWT_TEMPLATE });
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'publishable-key',
      expect.objectContaining({
        global: {
          headers: { Authorization: 'Bearer supabase-jwt' }
        }
      })
    );
  });

  it('uses the legacy anon key env var when the publishable key is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon-key';
    mockAuth.mockResolvedValue({ userId: null, getToken: jest.fn() });

    await createClient();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'legacy-anon-key',
      expect.any(Object)
    );
  });

  it('logs and rethrows if Clerk auth() fails before token lookup', async () => {
    const authError = new Error('Clerk is not configured');
    mockAuth.mockRejectedValue(authError);

    await expect(createClient()).rejects.toBe(authError);
    expect(mockLogger.error).toHaveBeenCalledWith('Auth check failed', {
      error: authError
    });
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it('throws a config error when the Clerk supabase JWT template is missing', async () => {
    const getToken = jest.fn().mockRejectedValue(
      Object.assign(new Error('Not Found'), {
        clerkError: true,
        code: 'api_response_error',
        status: 404
      })
    );
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    await expect(createClient()).rejects.toBeInstanceOf(
      SupabaseAuthConfigError
    );
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledWith({ template: SUPABASE_JWT_TEMPLATE });
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it('does not classify non-Clerk 404 errors as auth misconfiguration', async () => {
    const notClerkError = Object.assign(new Error('Not Found'), {
      status: 404
    });
    const getToken = jest.fn().mockRejectedValue(notClerkError);
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    await expect(createClient()).rejects.toBe(notClerkError);
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledWith({ template: SUPABASE_JWT_TEMPLATE });
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });

  it('throws a config error when the Clerk supabase JWT template returns no token', async () => {
    const getToken = jest.fn().mockResolvedValue(null);
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    await expect(createClient()).rejects.toBeInstanceOf(
      SupabaseAuthConfigError
    );
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(getToken).toHaveBeenCalledWith({ template: SUPABASE_JWT_TEMPLATE });
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });
});
