/**
 * @jest-environment node
 */
import { auth } from '@clerk/nextjs/server';
import { getSetupDiagnostics } from './setup';

jest.mock('server-only', () => ({}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

const mockAuth = auth as jest.Mock;
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
  process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.com';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash_token';
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

describe('getSetupDiagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    configureReadyEnv();
    mockAuth.mockResolvedValue({
      userId: 'user_123',
      getToken: jest.fn().mockResolvedValue('supabase-jwt')
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns ready checks when Clerk, Supabase, Longbridge, and Upstash are configured', async () => {
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
  });

  it('reports missing environment variables without exposing configured values', async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    delete process.env.LONGPORT_APP_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;

    const diagnostics = await getSetupDiagnostics();

    expect(diagnostics.status).toBe('blocked');
    expect(findCheck(diagnostics, 'clerk').status).toBe('blocked');
    expect(findCheck(diagnostics, 'supabase').status).toBe('blocked');
    expect(findCheck(diagnostics, 'longbridge').status).toBe('blocked');
    expect(findCheck(diagnostics, 'upstash').status).toBe('warning');
    expect(JSON.stringify(diagnostics)).toContain(
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'
    );
    expect(JSON.stringify(diagnostics)).not.toContain('sk_test_secret');
    expect(JSON.stringify(diagnostics)).not.toContain(
      'longbridge_access_token'
    );
    expect(JSON.stringify(diagnostics)).not.toContain('upstash_token');
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
  });

  it('warns when an unexpected Clerk token verification error occurs', async () => {
    const getToken = jest.fn().mockRejectedValue(new Error('temporary outage'));
    mockAuth.mockResolvedValue({ userId: 'user_123', getToken });

    const diagnostics = await getSetupDiagnostics();

    const supabase = findCheck(diagnostics, 'supabase');
    expect(diagnostics.status).toBe('warning');
    expect(supabase.status).toBe('warning');
    expect(supabase.details).toContain(
      'Clerk JWT template "supabase" could not be verified.'
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

  it('warns when Upstash Redis is not configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const diagnostics = await getSetupDiagnostics();

    const upstash = findCheck(diagnostics, 'upstash');
    expect(diagnostics.status).toBe('warning');
    expect(upstash.status).toBe('warning');
    expect(upstash.summary).toBe(
      'Distributed API rate limiting is running in fail-open mode.'
    );
    expect(upstash.details).toContain(
      'Missing environment variables: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN.'
    );
  });
});
