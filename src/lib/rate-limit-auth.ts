import { auth } from '@clerk/nextjs/server';
import { logger } from './logger';

const optionalAuthWarningRoutes = new Set<string>();

export async function getOptionalRateLimitUserId(
  route: string
): Promise<string | null> {
  try {
    const authResult = await auth();
    return authResult.userId ?? null;
  } catch (error) {
    if (!optionalAuthWarningRoutes.has(route)) {
      optionalAuthWarningRoutes.add(route);
      logger.warn('Optional auth lookup failed for rate limiting', {
        route,
        error
      });
    }

    return null;
  }
}
