import { getErrorTaxonomy } from '@/lib/observability/error-taxonomy';

export const PORTFOLIO_AUTH_MISCONFIGURED_CODE = 'RLS_AUTH_MISCONFIGURED';

export const PORTFOLIO_AUTH_MISCONFIGURED_MESSAGE = getErrorTaxonomy(
  'RLS_AUTH_MISCONFIGURED'
).dashboardMessage;

export const PORTFOLIO_AUTH_MISCONFIGURED_REMEDIATION =
  'Configure Clerk JWT template "supabase" and configure Supabase JWT verification for Clerk-issued tokens.';
