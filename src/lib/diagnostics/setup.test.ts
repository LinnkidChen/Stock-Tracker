/**
 * @jest-environment node
 */
import { auth } from '@clerk/nextjs/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSetupDiagnostics } from './setup';

jest.mock('server-only', () => ({}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}));

const mockAuth = auth as jest.Mock;
const mockCreateSupabaseClient = createSupabaseClient as jest.Mock;
const originalEnv = process.env;

function configureReadyEnv() {
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_value';
  process.env.CLERK_SECRET_KEY = 'sk_test_secret';
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
    'supabase_publishable_secret';
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.LONGPORT_APP_KEY = 'longbridge_app_key';
  process.env.LONGPORT_APP_SECRET = 'longbridge_app_secret';
  process.env.LONGPORT_ACCESS_TOKEN = 'longbridge_access_token';
}

function findCheck(
  diagnostics: Awaited<ReturnType<typeof getSetupDiagnostics>>,
  id: string
) {
  const check = diagnostics.checks.find((candidate) => candidate.id === id);
  if (!check) {
    throw new Error(`Missing diagnostic check: ${id}`);
  }
  return check;
}

function createRlsQuery(result: { error: unknown }) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    limit: jest.fn(() => Promise.resolve(result))
  };

  return query;
}

function mockRlsProbeClient(
  results: Array<{ error: unknown }> = [{ error: null }, { error: null }]
) {
  const from = jest.fn();
  const queries = results.map(createRlsQuery);

  queries.forEach((query) => from.mockReturnValueOnce(query));
  from.mockReturnValue(queries[queries.length - 1]);
  mockCreateSupabaseClient.mockReturnValue({ from });

  return { from, queries };
}

describe('getSetupDiagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    configureReadyEnv();
    mockRlsProbeClient();
    mockAuth.mockResolvedValue({
      userId: 'user_123',
      getToken: jest.fn().mockResolvedValue('supabase-jwt')
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns ready checks when Clerk, Supabase, RLS, and Longbridge are configured', async () => {
    const diagnostics = await getSetupDiagnostics();

    expect(diagnostics.status).toBe('ready');
    expect(diagnostics.checks).toHaveLength(4);
    expect(diagnostics.checks.map((check) => check.status)).toEqual([
      'ready',
      'ready',
      'ready',
      'ready'
    ]);
    expect(findCheck(diagnostics, 'supabase').details).toContain(
      'Clerk JWT template "supabase" returned a token.'
    );
    expect(findCheck(diagnostics, 'supabase-rls').details).toContain(
      'Read-only RLS probe succeeded for watchlist items.'
    );
    expect(mockCreateSupabaseClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'supabase_publishable_secret',
      expect.objectContaining({
        global: {
          headers: {
            Authorization: 'Bearer supabase-jwt'
          }
        }
      })
    );
  });

  it('reports missing environment variables without exposing configured values', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    delete process.env.LONGPORT_APP_KEY;

    const diagnostics = await getSetupDiagnostics();

    expect(diagnostics.status).toBe('blocked');
    expect(findCheck(diagnostics, 'clerk').status).toBe('blocked');
    expect(findCheck(diagnostics, 'supabase').status).toBe('blocked');
    expect(findCheck(diagnostics, 'supabase-rls').status).toBe('blocked');
    expect(findCheck(diagnostics, 'longbridge').status).toBe('blocked');
    expect(JSON.stringify(diagnostics)).toContain(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
    );
    expect(JSON.stringify(diagnostics)).not.toContain('sk_test_secret');
    expect(JSON.stringify(diagnostics)).not.toContain(
      'longbridge_access_token'
    );
  });

  it('accepts the legacy Supabase anon key when the publishable key is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy_anon_secret';

    const diagnostics = await getSetupDiagnostics();

    const supabase = findCheck(diagnostics, 'supabase');
    expect(supabase.status).toBe('ready');
    expect(supabase.details).toContain(
      'Using legacy Supabase anon key environment variable.'
    );
    expect(findCheck(diagnostics, 'supabase-rls').status).toBe('ready');
    expect(JSON.stringify(diagnostics)).not.toContain('legacy_anon_secret');
  });

  it('blocks Supabase when the URL is not an absolute URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';

    const diagnostics = await getSetupDiagnostics();

    const supabase = findCheck(diagnostics, 'supabase');
    expect(supabase.status).toBe('blocked');
    expect(supabase.details).toContain(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.'
    );
    expect(findCheck(diagnostics, 'supabase-rls').details).toContain(
      'Valid Supabase URL and publishable key configuration are required before RLS access can be checked.'
    );
  });

  it('blocks Supabase when the Clerk JWT template is missing', async () => {
    const getToken = jest.fn().mockRejectedValue(
      Object.assign(new Error('Not Found'), {
        clerkError: true,
        code: 'api_response_error',
        status: 404
      })
    );
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    const diagnostics = await getSetupDiagnostics();

    expect(getToken).toHaveBeenCalledWith({ template: 'supabase' });
    const supabase = findCheck(diagnostics, 'supabase');
    expect(supabase.status).toBe('blocked');
    expect(supabase.details).toContain(
      'Clerk JWT template "supabase" was not found.'
    );
    expect(findCheck(diagnostics, 'supabase-rls').status).toBe('blocked');
  });

  it('blocks Supabase when the Clerk JWT template returns an empty token', async () => {
    const getToken = jest.fn().mockResolvedValue('');
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    const diagnostics = await getSetupDiagnostics();

    const supabase = findCheck(diagnostics, 'supabase');
    expect(supabase.status).toBe('blocked');
    expect(supabase.details).toContain(
      'Clerk JWT template "supabase" returned no token.'
    );
    expect(findCheck(diagnostics, 'supabase-rls').status).toBe('blocked');
  });

  it('warns when an unexpected Clerk token verification error occurs', async () => {
    const getToken = jest.fn().mockRejectedValue(new Error('temporary outage'));
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    const diagnostics = await getSetupDiagnostics();

    const supabase = findCheck(diagnostics, 'supabase');
    expect(diagnostics.status).toBe('warning');
    expect(supabase.status).toBe('warning');
    expect(findCheck(diagnostics, 'supabase-rls').status).toBe('warning');
    expect(supabase.details).toContain(
      'Clerk JWT template "supabase" could not be verified.'
    );
  });

  it('blocks Supabase RLS when a table access probe fails', async () => {
    mockRlsProbeClient([
      { error: null },
      {
        error: {
          code: '42501',
          message: 'permission denied for table stock_portfolio_holdings'
        }
      }
    ]);

    const diagnostics = await getSetupDiagnostics();

    const rls = findCheck(diagnostics, 'supabase-rls');
    expect(diagnostics.status).toBe('blocked');
    expect(rls.status).toBe('blocked');
    expect(rls.details).toContain(
      'Read-only RLS probe succeeded for watchlist items.'
    );
    expect(rls.details).toContain(
      'Read-only RLS probe failed for portfolio holdings: permission denied for table stock_portfolio_holdings; code 42501.'
    );
  });

  it('blocks Longbridge when any credential variable is missing', async () => {
    delete process.env.LONGPORT_ACCESS_TOKEN;

    const diagnostics = await getSetupDiagnostics();

    const longbridge = findCheck(diagnostics, 'longbridge');
    expect(longbridge.status).toBe('blocked');
    expect(longbridge.details).toContain(
      'Missing environment variables: LONGPORT_ACCESS_TOKEN.'
    );
    expect(JSON.stringify(diagnostics)).not.toContain('longbridge_app_secret');
  });
});
