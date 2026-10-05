// Order numbering: SWD-<year>-<6-digit sequence>, sequence resets per year.
//
// Uses an atomic upsert-increment against a small per-year counter row
// (INSERT ... ON CONFLICT DO UPDATE ... RETURNING) so two concurrent
// checkouts can never be handed the same number — Postgres serializes
// the conflicting writes rather than us reading-then-computing-then-writing.

import { db } from "./db/client";
import { orderCounters } from "./db/schema";
import { sql } from "drizzle-orm";

export async function nextOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();

  const [row] = await db
    .insert(orderCounters)
    .values({ year, seq: 1 })
    .onConflictDoUpdate({
      target: orderCounters.year,
      set: { seq: sql`${orderCounters.seq} + 1` },
    })
    .returning({ seq: orderCounters.seq });

  const nextSeq = row.seq.toString().padStart(6, "0");
  return `SWD-${year}-${nextSeq}`;
}
