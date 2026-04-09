import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl =
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const redisToken =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

const limiters: Record<string, Ratelimit> = {};

function getLimiter(
  prefix: string,
  maxRequests: number,
  windowSeconds: number
): Ratelimit | null {
  if (!redis) return null;

  if (!limiters[prefix]) {
    limiters[prefix] = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
      prefix: `ratelimit:${prefix}`,
    });
  }

  return limiters[prefix];
}

const LIMITS = {
  booking: { maxRequests: 5, windowSeconds: 900 },
  contact: { maxRequests: 3, windowSeconds: 900 },
} as const;

type LimitKey = keyof typeof LIMITS;

/**
 * Rate-limits a request by IP address.
 * Returns { success: true } if allowed, { success: false } if blocked.
 * If Upstash is not configured (local dev), always allows.
 */
export async function rateLimit(
  key: LimitKey,
  identifier: string
): Promise<{ success: boolean }> {
  const config = LIMITS[key];
  const limiter = getLimiter(key, config.maxRequests, config.windowSeconds);

  // No Redis configured → allow (local dev / graceful fallback)
  if (!limiter) return { success: true };

  return limiter.limit(identifier);
}
