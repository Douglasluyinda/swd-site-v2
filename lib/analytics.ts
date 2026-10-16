// Real business analytics, computed from the live database — not mocked,
// not a third-party event pipeline. This is deliberately separate from
// Vercel Web Analytics/Speed Insights (wired in app/layout.tsx), which
// measure page-level traffic and performance once deployed to Vercel and
// report through the Vercel dashboard, not this app.

import { db } from "./db/client";
import { orderItems, orders, products } from "./db/schema";
import { sql, gte } from "drizzle-orm";

export type DashboardMetrics = {
  revenue30d: number;
  orderCount30d: number;
  averageOrderValue30d: number;
  statusCounts: { status: string; count: number }[];
  revenueByDay: { day: string; revenue: number }[];
  topProducts: { title: string; unitsSold: number; revenue: number }[];
};

const PAID_STATUSES = [
  "PAID",
  "SUPPLIER_ORDER_PENDING",
  "SUPPLIER_ORDERED",
  "PROCESSING",
  "SHIPPED",
  "IN_TRANSIT",
  "DELIVERED",
];

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const recentOrders = await db
    .select({
      id: orders.id,
      total: orders.total,
      status: orders.status,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(gte(orders.createdAt, since));

  const paidOrders = recentOrders.filter((o) => PAID_STATUSES.includes(o.status));
  const revenue30d = paidOrders.reduce((sum, o) => sum + (o.total ?? 0), 0);
  const orderCount30d = recentOrders.length;
  const averageOrderValue30d = paidOrders.length > 0 ? revenue30d / paidOrders.length : 0;

  const statusCountsMap = new Map<string, number>();
  for (const o of recentOrders) {
    statusCountsMap.set(o.status, (statusCountsMap.get(o.status) ?? 0) + 1);
  }
  const statusCounts = Array.from(statusCountsMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  const revenueByDayMap = new Map<string, number>();
  for (const o of paidOrders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    revenueByDayMap.set(day, (revenueByDayMap.get(day) ?? 0) + (o.total ?? 0));
  }
  const revenueByDay = Array.from(revenueByDayMap.entries())
    .map(([day, revenue]) => ({ day, revenue }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const topProductsRaw = await db
    .select({
      title: products.title,
      unitsSold: sql<number>`sum(${orderItems.quantity})`.mapWith(Number),
      revenue: sql<number>`sum(${orderItems.quantity} * ${orderItems.unitPrice})`.mapWith(Number),
    })
    .from(orderItems)
    .innerJoin(products, sql`${orderItems.productId} = ${products.id}`)
    .innerJoin(orders, sql`${orderItems.orderId} = ${orders.id}`)
    .where(gte(orders.createdAt, since))
    .groupBy(products.id, products.title)
    .orderBy(sql`sum(${orderItems.quantity} * ${orderItems.unitPrice}) desc`)
    .limit(5);

  return {
    revenue30d,
    orderCount30d,
    averageOrderValue30d,
    statusCounts,
    revenueByDay,
    topProducts: topProductsRaw,
  };
}
