import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cashSessions, inventoryBalances, offlineSyncFailures, products, purchaseOrders, repairTickets, sopVersions } from "@/lib/db/schema";
import { CASH_SESSION_OPEN_HOURS, QUOTE_WAITING_DAYS, READY_UNCOLLECTED_DAYS, type AlertCounts } from "@/lib/alerts";
import { kampalaDateKey } from "@/lib/reports";
import { reviewState } from "@/lib/sops";

const ago = (ms: number) => new Date(Date.now() - ms);
const H = 3_600_000, D = 24 * H;
const n = (v: unknown) => Number(v ?? 0);

export async function loadAlertCounts(): Promise<AlertCounts> {
  const [low] = await db.select({ c: sql<number>`count(*)` }).from(
    db.select({ id: products.id }).from(products).leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id))
      .where(sql`${products.reorderLevel} is not null`).groupBy(products.id)
      .having(sql`coalesce(sum(${inventoryBalances.quantity}),0) <= ${products.reorderLevel}`).as("low"),
  );
  const [pend] = await db.select({ c: sql<number>`count(*)` }).from(cashSessions).where(eq(cashSessions.status, "PENDING_APPROVAL"));
  const [open] = await db.select({ c: sql<number>`count(*)` }).from(cashSessions)
    .where(and(eq(cashSessions.status, "OPEN"), lt(cashSessions.openedAt, ago(CASH_SESSION_OPEN_HOURS * H))));
  const [po] = await db.select({ c: sql<number>`count(*)` }).from(purchaseOrders).where(eq(purchaseOrders.status, "PENDING_APPROVAL"));
  const [q] = await db.select({ c: sql<number>`count(*)` }).from(repairTickets)
    .where(and(eq(repairTickets.status, "QUOTED"), lt(repairTickets.quotedAt, ago(QUOTE_WAITING_DAYS * D))));
  const [r] = await db.select({ c: sql<number>`count(*)` }).from(repairTickets)
    .where(and(eq(repairTickets.status, "READY"), lt(repairTickets.updatedAt, ago(READY_UNCOLLECTED_DAYS * D))));
  const [off] = await db.select({ c: sql<number>`count(*)` }).from(offlineSyncFailures).where(sql`${offlineSyncFailures.resolvedAt} is null`);
  const today = kampalaDateKey(new Date());
  const approved = await db.select({ reviewDate: sopVersions.reviewDate }).from(sopVersions).where(eq(sopVersions.status, "APPROVED"));
  const sopReviewsDue = approved.filter((v) => ["OVERDUE", "DUE_SOON"].includes(reviewState(v.reviewDate, today))).length;
  return {
    lowStock: n(low.c), cashPendingApproval: n(pend.c), cashLeftOpen: n(open.c), poAwaitingApproval: n(po.c),
    quotesWaiting: n(q.c), repairsUncollected: n(r.c), sopReviewsDue, offlineSyncIssues: n(off.c),
  };
}
