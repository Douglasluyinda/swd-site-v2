import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  cashMovements, cashSessions, inventoryBalances, products, repairParts, repairPayments, repairTickets,
  saleItems, saleReturnItems, saleReturns, sales, supplierPayments,
} from "@/lib/db/schema";
import { KAMPALA_OFFSET_HOURS, buildDays, daysIn, valueStock, type DayRaw, type Period } from "@/lib/reports";
import { isLowStock } from "@/lib/inventory-ledger";

// Read-only. Timestamps are stored as UTC; a "day" is a Kampala calendar day.
const dayOf = (col: unknown) => sql<string>`to_char(${col} + ${sql.raw(`interval '${Number(KAMPALA_OFFSET_HOURS)} hours'`)}, 'YYYY-MM-DD')`;
const inRange = (col: Parameters<typeof gte>[0], p: Period): SQL => and(gte(col, p.from), lt(col, p.to))!;
const n = (v: unknown) => Number(v ?? 0);

export async function loadReport(period: Period) {
  const days = daysIn(period);
  const merge = new Map<string, DayRaw>();
  const put = (day: string, patch: Partial<DayRaw>) => merge.set(day, { ...(merge.get(day) ?? { day }), ...patch });

  const dSales = dayOf(sales.createdAt);
  for (const r of await db.select({
    day: dSales, count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${sales.total}),0)`, disc: sql<number>`coalesce(sum(${sales.discountAmount}),0)`,
  }).from(sales).where(inRange(sales.createdAt, period)).groupBy(dSales)) {
    put(r.day, { salesCount: n(r.count), salesTotal: n(r.total), discounts: n(r.disc) });
  }

  const dItems = dayOf(sales.createdAt);
  for (const r of await db.select({
    day: dItems,
    cogs: sql<number>`coalesce(sum(${saleItems.quantity} * coalesce(${saleItems.unitCost},0)),0)`,
    missing: sql<number>`count(*) filter (where ${saleItems.unitCost} is null)`,
  }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId)).where(inRange(sales.createdAt, period)).groupBy(dItems)) {
    put(r.day, { cogs: n(r.cogs), linesWithoutCost: n(r.missing) });
  }

  const dRet = dayOf(saleReturns.createdAt);
  for (const r of await db.select({ day: dRet, total: sql<number>`coalesce(sum(${saleReturns.refundTotal}),0)` })
    .from(saleReturns).where(inRange(saleReturns.createdAt, period)).groupBy(dRet)) put(r.day, { refunds: n(r.total) });
  for (const r of await db.select({ day: dRet, cost: sql<number>`coalesce(sum(${saleReturnItems.quantity} * coalesce(${saleItems.unitCost},0)),0)` })
    .from(saleReturnItems).innerJoin(saleReturns, eq(saleReturns.id, saleReturnItems.returnId))
    .innerJoin(saleItems, eq(saleItems.id, saleReturnItems.saleItemId)).where(inRange(saleReturns.createdAt, period)).groupBy(dRet)) {
    put(r.day, { refundedCost: n(r.cost) });
  }

  const dRep = dayOf(repairPayments.createdAt);
  for (const r of await db.select({ day: dRep, total: sql<number>`coalesce(sum(${repairPayments.amount}),0)` })
    .from(repairPayments).where(inRange(repairPayments.createdAt, period)).groupBy(dRep)) put(r.day, { repairRevenue: n(r.total) });

  // Repair direct costs land on the day the device was handed over.
  const dCol = dayOf(repairTickets.collectedAt);
  const ext = await db.select({ day: dCol, v: sql<number>`coalesce(sum(${repairTickets.externalCost}),0)` })
    .from(repairTickets).where(and(eq(repairTickets.status, "COLLECTED"), inRange(repairTickets.collectedAt, period))).groupBy(dCol);
  const prt = await db.select({ day: dCol, v: sql<number>`coalesce(sum(${repairParts.quantity} * coalesce(${repairParts.unitCost},0)),0)` })
    .from(repairParts).innerJoin(repairTickets, eq(repairTickets.id, repairParts.ticketId))
    .where(and(eq(repairTickets.status, "COLLECTED"), inRange(repairTickets.collectedAt, period))).groupBy(dCol);
  const rc = new Map<string, number>();
  for (const r of [...ext, ...prt]) rc.set(r.day, (rc.get(r.day) ?? 0) + n(r.v));
  for (const [day, v] of rc) put(day, { repairCost: v });

  const dMove = dayOf(cashMovements.createdAt);
  for (const r of await db.select({ day: dMove, v: sql<number>`coalesce(sum(${cashMovements.amount}),0)` })
    .from(cashMovements).where(and(eq(cashMovements.type, "EXPENSE"), inRange(cashMovements.createdAt, period))).groupBy(dMove)) {
    put(r.day, { expenses: n(r.v) });
  }
  const dSup = dayOf(supplierPayments.createdAt);
  for (const r of await db.select({ day: dSup, v: sql<number>`coalesce(sum(${supplierPayments.amount}),0)` })
    .from(supplierPayments).where(inRange(supplierPayments.createdAt, period)).groupBy(dSup)) put(r.day, { supplierPayments: n(r.v) });

  const built = buildDays([...merge.values()], days);

  const topProducts = await db.select({
    sku: saleItems.sku, title: saleItems.title,
    units: sql<number>`sum(${saleItems.quantity})`,
    revenue: sql<number>`sum(${saleItems.quantity} * ${saleItems.unitPrice})`,
    cost: sql<number>`sum(${saleItems.quantity} * coalesce(${saleItems.unitCost},0))`,
  }).from(saleItems).innerJoin(sales, eq(sales.id, saleItems.saleId)).where(inRange(sales.createdAt, period))
    .groupBy(saleItems.sku, saleItems.title).orderBy(sql`sum(${saleItems.quantity} * ${saleItems.unitPrice}) desc`).limit(20);

  const cash = await db.select({
    sessions: sql<number>`count(*)`,
    variance: sql<number>`coalesce(sum(${cashSessions.variance}),0)`,
    pending: sql<number>`count(*) filter (where ${cashSessions.status} = 'PENDING_APPROVAL')`,
    overThreshold: sql<number>`count(*) filter (where abs(coalesce(${cashSessions.variance},0)) > 0)`,
  }).from(cashSessions).where(and(inRange(cashSessions.closedAt, period)));

  return {
    period, ...built,
    topProducts: topProducts.map((p) => ({ ...p, units: n(p.units), revenue: n(p.revenue), cost: n(p.cost) })),
    cash: { sessionsClosed: n(cash[0].sessions), netVariance: n(cash[0].variance), pendingApproval: n(cash[0].pending), withVariance: n(cash[0].overThreshold) },
  };
}

// Point-in-time (now), not for the period.
export async function loadStockValuation() {
  const rows = await db.select({
    quantity: sql<number>`coalesce(sum(${inventoryBalances.quantity}),0)`, cost: sql<number | null>`coalesce(${products.costPrice}, ${products.supplierCost})`,
    reorder: products.reorderLevel, id: products.id, title: products.title,
  }).from(products).leftJoin(inventoryBalances, eq(inventoryBalances.productId, products.id)).groupBy(products.id);
  const val = valueStock(rows.map((r) => ({ quantity: n(r.quantity), unitCost: r.cost == null ? null : n(r.cost) })));
  const low = rows.filter((r) => isLowStock(n(r.quantity), r.reorder)).length;
  return { ...val, lowStockCount: low };
}
