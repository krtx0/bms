// ponytail: single-process in-memory limiter, resets on restart — same accepted limitation as
// lib/auth.ts's login limiter (no shared store like Redis in this app). Kept as its own instance
// per limiter rather than sharing lib/auth.ts's login-attempt Map, so a burst of spam on one
// limiter (e.g. the public order form) can never interact with another's lockout state (e.g.
// login).
export function createRateLimiter(maxAttempts: number, windowMs: number) {
  const attempts = new Map<string, number[]>();
  return {
    isLimited(key: string): boolean {
      const now = Date.now();
      const recent = (attempts.get(key) || []).filter((t) => now - t < windowMs);
      attempts.set(key, recent);
      return recent.length >= maxAttempts;
    },
    record(key: string): void {
      const recent = attempts.get(key) || [];
      recent.push(Date.now());
      attempts.set(key, recent);
    },
  };
}
