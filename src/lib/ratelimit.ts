// Nutri Tummies — DB-backed rate limiter (fixed window)
// Works on serverless (stateless functions) because the counters live in the
// database rather than process memory. Opportunistic cleanup keeps the table
// small without a cron job.

import { db } from "@/lib/db";

export type RateVerdict = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Consume one unit from the `{scope}:{identity}` limit of `max` per `windowSec`.
 * Example: rateLimit("ai", user.id, 10, 60) → max 10 AI calls per minute per user.
 */
export async function rateLimit(scope: string, identity: string, max: number, windowSec: number): Promise<RateVerdict> {
  const now = Date.now();
  const bucket = Math.floor(now / (windowSec * 1000)); // fixed window id
  const key = `${scope}:${identity}:${bucket}`;
  const windowStartMs = bucket * windowSec * 1000;
  const expiresAt = new Date(windowStartMs + windowSec * 1000);

  try {
    // atomic-ish upsert: try create first (common case), fall back to increment
    const created = await db.rateLimit.create({ data: { key, count: 1, expiresAt } }).catch(() => null);
    let count: number;
    if (created) {
      count = 1;
    } else {
      const updated = await db.rateLimit.update({
        where: { key },
        data: { count: { increment: 1 } },
      });
      count = updated.count;
    }

    // opportunistic cleanup (~2% of calls) keeps the table tiny
    if (Math.random() < 0.02) {
      await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => {});
    }

    const remaining = Math.max(0, max - count);
    return {
      allowed: count <= max,
      remaining,
      retryAfterSec: Math.max(1, Math.ceil((windowStartMs + windowSec * 1000 - now) / 1000)),
    };
  } catch (err) {
    // limiter failure must never take the API down
    console.error("[ratelimit]", err);
    return { allowed: true, remaining: max, retryAfterSec: 0 };
  }
}

/** Standard 429 response for AI endpoints. */
export function tooManyRequests(retryAfterSec: number, message: string) {
  return Response.json({ error: message, retryAfterSec }, { status: 429 });
}

// Policy: burst protection on expensive AI endpoints.
// (Entitlement limits in auth.ts still govern daily/weekly quotas.)
export const AI_BURST_LIMIT = 10; // AI calls…
export const AI_BURST_WINDOW = 60; // …per 60 seconds
export const AI_RATE_MESSAGE =
  "That's a lot of AI magic in one minute — give it a breather and try again shortly.";
