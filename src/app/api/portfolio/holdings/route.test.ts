/**
 * @jest-environment node
 */
import { auth } from '@clerk/nextjs/server';
import { SupabaseAuthConfigError } from '@/lib/supabase/server';
import { getPortfolioSnapshot } from '@/lib/portfolio/service';
import { GET, POST } from './route';

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn()
}));

jest.mock('@/lib/portfolio/service', () => ({
  getPortfolioSnapshot: jest.fn()
}));

const holding = {
  id: 'user_123:AAPL',
  userId: 'user_123',
  symbol: 'AAPL',
  quantity: 10,
  avgCost: 150,
  costBasis: 1500,
  realizedPnl: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
};

const summary = {
  currency: 'USD',
  cashBalance: -1500,
  holdingsCount: 1,
  investedCost: 1500,
  realizedPnl: 0,
  dividends: 0,
  fees: 0,
  deposits: 0,
  withdrawals: 0
};

function createRequest() {
  return new Request('http://localhost/api/portfolio/holdings');
}

describe('/api/portfolio/holdings', () => {
  const mockAuth = auth as jest.Mock;
  const mockGetSnapshot = getPortfolioSnapshot as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 if user is unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await GET(createRequest());

    expect(res.status).toBe(401);
  });

  it('returns derived holdings and summary for the authenticated user', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetSnapshot.mockResolvedValue({
      holdings: [holding],
      summary,
      transactions: []
    });

    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.holdings).toEqual([holding]);
    expect(json.data.summary).toEqual(summary);
    expect(mockGetSnapshot).toHaveBeenCalledWith('user_123');
  });

  it('returns 503 if portfolio auth is misconfigured', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_123' });
    mockGetSnapshot.mockRejectedValue(
      new SupabaseAuthConfigError(
        'Clerk Supabase JWT template is not configured'
      )
    );

    const res = await GET(createRequest());
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json.error).toEqual({
      code: 'PORTFOLIO_AUTH_MISCONFIGURED',
      message: 'Portfolio authentication is not configured on the server.'
    });
  });

  it('does not allow direct holding writes', async () => {
    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(405);
    expect(json.error.code).toBe('PORTFOLIO_HOLDINGS_DERIVED');
  });
});
