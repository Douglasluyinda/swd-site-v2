import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db/client";
import { offlineSyncFailures, posTerminals } from "@/lib/db/schema";
import { createSale } from "@/lib/sales";
import { getSettings } from "@/lib/settings-service";
import { isRetryable, validateOfflineSale, type OfflineSale } from "@/lib/offline";

// Inside transactions use `tx`, never the global `db` (single-connection pool).

// Registers THIS device as the one offline terminal, replacing any previous one.
export async function registerTerminal(input: { name: string; by: number }) {
  const name = input.name.trim();
  if (!name) throw new Error("Give the terminal a name.");
  const id = randomUUID();
  return db.transaction(async (tx) => {
    // Deactivate first: the partial unique index allows one active terminal.
    await tx.update(posTerminals).set({ active: false, deactivatedAt: new Date() }).where(eq(posTerminals.active, true));
    await tx.insert(posTerminals).values({ id, name, registeredBy: input.by });
    return { terminalId: id };
  });
}

export async function deactivateTerminal() {
  await db.update(posTerminals).set({ active: false, deactivatedAt: new Date() }).where(eq(posTerminals.active, true));
}

export async function activeTerminal() {
  const [t] = await db.select().from(posTerminals).where(eq(posTerminals.active, true)).limit(1);
  return t ?? null;
}

export type SyncResult =
  | { ok: true; receiptNumber: string; duplicate: boolean }
  | { ok: false; error: string; retryable: boolean };

// Records one queued sale. Safe to call repeatedly with the same sale: the sale's
// own id is the idempotency key, so a retry returns the original receipt.
export async function syncOfflineSale(input: { sale: OfflineSale; employeeId: number; role: string }): Promise<SyncResult> {
  const { sale } = input;
  const fail = async (error: string): Promise<SyncResult> => {
    const retryable = isRetryable(error);
    if (!retryable) {
      // One open failure row per sale: refresh it instead of piling up retries.
      await db.delete(offlineSyncFailures).where(and(eq(offlineSyncFailures.clientId, sale.clientId), isNull(offlineSyncFailures.resolvedAt)));
      await db.insert(offlineSyncFailures).values({
        clientId: sale.clientId, employeeId: input.employeeId, terminalId: sale.terminalId, reason: error,
        payload: JSON.stringify(sale), occurredAt: new Date(sale.occurredAt),
      });
    }
    return { ok: false, error, retryable };
  };

  try {
    if (!(await getSettings())["offline.enabled"]) return fail("Offline sales are switched off.");
    const t = await activeTerminal();
    if (!t || t.id !== sale.terminalId) return { ...(await fail("This device is not the registered offline terminal.")) };
    if (sale.employeeId !== input.employeeId) return fail("This sale was made by another employee. They must sign in to sync it.");
    const bad = validateOfflineSale(sale, new Date());
    if (bad) return fail(bad);

    const r = await createSale({
      idempotencyKey: sale.clientId, employeeId: input.employeeId, role: input.role, lines: sale.lines,
      discountPercent: sale.discountPercent, tendered: sale.tendered, customerName: sale.customerName, customerPhone: sale.customerPhone,
      offline: { terminalId: t.id, occurredAt: new Date(sale.occurredAt), expectedTotal: sale.expectedTotal },
    });
    await db.update(offlineSyncFailures).set({ resolvedAt: new Date() }).where(and(eq(offlineSyncFailures.clientId, sale.clientId), isNull(offlineSyncFailures.resolvedAt)));
    return { ok: true, receiptNumber: r.receiptNumber, duplicate: r.duplicate };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Sync failed.");
  }
}
