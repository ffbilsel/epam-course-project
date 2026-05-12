import { RateLimiterMemory } from "rate-limiter-flexible";
import { AppError } from "@/lib/errors/AppError";

/**
 * In-process rate limiters per FR-029. No external Redis in Phase 1.
 */
export const limiters = {
  auth: new RateLimiterMemory({ points: 5, duration: 5 * 60 }),
  register: new RateLimiterMemory({ points: 3, duration: 60 * 60 }),
  attachments: new RateLimiterMemory({ points: 20, duration: 60 * 60 }),
} as const;

/**
 * Consumes one point from the named limiter for `key`. Throws
 * `RATE_LIMITED` (HTTP 429) when the bucket is empty.
 */
export async function rateLimit(name: keyof typeof limiters, key: string): Promise<void> {
  try {
    await limiters[name].consume(key, 1);
  } catch {
    throw new AppError("RATE_LIMITED");
  }
}
