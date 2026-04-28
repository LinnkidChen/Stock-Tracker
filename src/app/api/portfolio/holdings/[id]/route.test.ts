/**
 * @jest-environment node
 */
import { DELETE, PATCH } from './route';

describe('/api/portfolio/holdings/[id]', () => {
  it('does not allow direct holding updates', async () => {
    const res = await PATCH();
    const json = await res.json();

    expect(res.status).toBe(405);
    expect(json.error.code).toBe('PORTFOLIO_HOLDINGS_DERIVED');
  });

  it('does not allow direct holding deletes', async () => {
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(405);
    expect(json.error.code).toBe('PORTFOLIO_HOLDINGS_DERIVED');
  });
});
