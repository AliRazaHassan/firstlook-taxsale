type Bucket = { count: number; resetAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __firstlookRateLimits: Map<string, Bucket> | undefined;
}

const buckets = global.__firstlookRateLimits ?? new Map<string, Bucket>();
global.__firstlookRateLimits = buckets;

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

export function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): { ok: true; remaining: number; resetAt: number } | { ok: false; retryAfterSeconds: number; resetAt: number } {
  const now = Date.now();
  const key = `${scope}:${clientKey(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: Math.max(0, limit - 1), resetAt };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    };
  }

  current.count += 1;
  return { ok: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}

export function rateLimitResponse(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again shortly." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
        "Cache-Control": "no-store",
      },
    },
  );
}
