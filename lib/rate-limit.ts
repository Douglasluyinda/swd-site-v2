// Fixed-window rate limiting, backed by Postgres.
//
// Vercel serverless functions share no in-memory state across
// invocations, so an in-process counter would only limit within a
// single warm instance — not a real limit. This uses a row-locked
// transaction (SELECT ... FOR UPDATE) so concurrent requests hitting
// the same key are serialized rather than racing past the limit.
//
// For high-traffic production use, consider Upstash Redis (works
// natively on Vercel's edge network) instead — this Postgres version
// is a reasonable default that needs no extra service.

import { db } from "./db/client";
import { rateLimits } from "./db/schema";
import { eq, sql } from "drizzle-orm";

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(rateLimits)
      .where(eq(rateLimits.key, key))
      .for("update");

    const now = new Date();
    const windowExpired =
      !row || now.getTime() - new Date(row.windowStart).getTime() > windowSeconds * 1000;

    if (windowExpired) {
      await tx
        .insert(rateLimits)
        .values({ key, windowStart: now, count: 1 })
        .onConflictDoUpdate({
          target: rateLimits.key,
          set: { windowStart: now, count: 1 },
        });
      return { allowed: true, remaining: limit - 1 };
    }

    if (row.count >= limit) {
      return { allowed: false, remaining: 0 };
    }

    await tx
      .update(rateLimits)
      .set({ count: sql`${rateLimits.count} + 1` })
      .where(eq(rateLimits.key, key));

    return { allowed: true, remaining: limit - row.count - 1 };
  });
}
