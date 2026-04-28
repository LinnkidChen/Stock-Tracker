/**
 * @jest-environment node
 */
import {
  getClerkCredentialSetup,
  getMissingClerkCredentialKeys
} from './auth-setup';

jest.mock('server-only', () => ({}));

const originalEnv = process.env;

describe('Clerk credential setup helpers', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reports missing Clerk credential keys by name only', () => {
    expect(getMissingClerkCredentialKeys()).toEqual([
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY'
    ]);

    expect(getClerkCredentialSetup()).toEqual({
      isConfigured: false,
      missingKeys: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY']
    });
  });

  it('reports configured state without exposing secret values', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_value';
    process.env.CLERK_SECRET_KEY = 'sk_test_secret';

    const setup = getClerkCredentialSetup();

    expect(setup).toEqual({ isConfigured: true, missingKeys: [] });
    expect(JSON.stringify(setup)).not.toContain('sk_test_secret');
    expect(JSON.stringify(setup)).not.toContain('pk_test_value');
  });

  it('does not return configured secret values when only one key is missing', () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_secret';

    const setup = getClerkCredentialSetup();

    expect(setup).toEqual({
      isConfigured: false,
      missingKeys: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY']
    });
    expect(JSON.stringify(setup)).not.toContain('sk_test_secret');
  });
});
