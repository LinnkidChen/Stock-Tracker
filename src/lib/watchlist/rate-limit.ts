const rateBuckets = new Map<string, { count: number; reset: number }>();

export function getClientId(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  return ip || 'anonymous';
}

export function rateLimit(id: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const bucket = rateBuckets.get(id);

  if (!bucket || now > bucket.reset) {
    rateBuckets.set(id, { count: 1, reset: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((bucket.reset - now) / 1000)
    };
  }

  bucket.count++;
  return { allowed: true };
}

export function resetWatchlistRateLimit() {
  rateBuckets.clear();
}
