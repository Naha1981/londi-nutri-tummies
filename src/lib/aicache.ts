// Nutri Tummies — AI response cache (cost control)
// Caches expensive AI calls keyed by a deterministic hash of the inputs.
// Absorbs double-clicks, retries and identical repeat requests so token
// spend scales with *distinct* requests, not clicks.

import { createHash } from "crypto";
import { db } from "@/lib/db";

function sha(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function cacheKey(kind: string, payload: unknown): string {
  const canonical = typeof payload === "string" ? payload : JSON.stringify(payload);
  return sha(`${kind}::${canonical}`);
}

/**
 * Fetch a cached JSON value. Returns null on miss/expiry/unavailable.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const row = await db.aiCache.findUnique({ where: { key } });
    if (!row) return null;
    if (row.expiresAt < new Date()) return null;
    await db.aiCache.update({ where: { key }, data: { hits: { increment: 1 } } }).catch(() => {});
    return JSON.parse(row.response) as T;
  } catch {
    return null; // cache must never break the request
  }
}

/**
 * Store a JSON value with a TTL. Old rows for this kind are pruned
 * opportunistically.
 */
export async function cacheSet(kind: string, key: string, value: unknown, ttlMs: number): Promise<void> {
  try {
    const response = JSON.stringify(value);
    const expiresAt = new Date(Date.now() + ttlMs);
    await db.aiCache
      .upsert({
        where: { key },
        create: { key, kind, response, expiresAt },
        update: { response, expiresAt, hits: 0 },
      })
      .catch(() => {});
    if (Math.random() < 0.02) {
      await db.aiCache.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
    }
  } catch (err) {
    console.error("[ai-cache:set]", err);
  }
}

// TTLs (ms)
export const TTL_MEALPLAN = 60 * 60 * 1000; // 1 hour — absorbs double-clicks/retries
export const TTL_COACH = 24 * 60 * 60 * 1000; // 24 hours — identical question, cached answer
export const TTL_RECIPE = 7 * 24 * 60 * 60 * 1000; // 7 days — ingredient lists rarely change
export const TTL_SHOPPING = 7 * 24 * 60 * 60 * 1000; // 7 days — key is planId; new plans get new keys
