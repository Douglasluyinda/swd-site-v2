import { db } from "@/lib/db/client";
import { orderItems, orders, payments, products } from "@/lib/db/schema";
import { calculateProfit } from "@/lib/profit";
import { eq, inArray } from "drizzle-orm";

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-sm text-slate">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate">{sub}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const allOrders = await db.select().from(orders);
  const paidOrders = allOrders.filter((o) =>
    ["PAID", "SUPPLIER_ORDER_PENDING", "SUPPLIER_ORDERED", "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED"].includes(o.status),
  );

  const revenue = paidOrders.reduce((sum, o) => sum + o.total, 0);
  const avgOrderValue = paidOrders.length ? revenue / paidOrders.length : 0;

  const allItems = paidOrders.length
    ? await db
        .select()
        .from(orderItems)
        .where(inArray(orderItems.orderId, paidOrders.map((o) => o.id)))
    : [];

  const productCost = allItems.reduce((sum, i) => sum + i.unitSupplierCost * i.quantity, 0);
  const shippingCost = paidOrders.reduce((sum, o) => sum + o.shippingTotal, 0);

  const successfulPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.status, "successful"));
  const paymentFees = successfulPayments.reduce((sum, p) => sum + (p.feeAmount ?? 0), 0);

  const refunded = allOrders.filter((o) => o.status === "REFUNDED");
  const refundAmount = refunded.reduce((sum, o) => sum + o.total, 0);

  const profit = calculateProfit({
    sellingPrice: revenue,
    customerShipping: 0,
    supplierCost: productCost,
    supplierShipping: shippingCost,
    paymentFeeRate: 0,
    advertisingCostPerOrder: 0,
    refundReserveRate: 0,
  });
  // paymentFees and refunds are already known exactly (not estimated), so
  // subtract them directly rather than via the engine's rate-based inputs.
  const contributionProfit = profit.grossMargin - paymentFees - refundAmount;
  const contributionMargin = revenue > 0 ? contributionProfit / revenue : 0;

  const pendingSupplierOrders = allOrders.filter((o) => o.status === "SUPPLIER_ORDER_PENDING").length;
  const inTransit = allOrders.filter((o) => o.status === "IN_TRANSIT").length;
  const delivered = allOrders.filter((o) => o.status === "DELIVERED").length;

  const productCount = (await db.select().from(products)).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Dashboard</h1>
      <p className="mt-1 text-sm text-slate">
        {paidOrders.length} paid orders &middot; {productCount} products
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Revenue" value={`$${revenue.toFixed(2)}`} />
        <Metric label="Orders" value={String(allOrders.length)} sub={`${paidOrders.length} paid`} />
        <Metric label="Average order value" value={`$${avgOrderValue.toFixed(2)}`} />
        <Metric label="Product cost" value={`$${productCost.toFixed(2)}`} />
        <Metric label="Shipping cost" value={`$${shippingCost.toFixed(2)}`} />
        <Metric label="Payment fees" value={`$${paymentFees.toFixed(2)}`} />
        <Metric label="Refunds" value={`$${refundAmount.toFixed(2)}`} sub={`${refunded.length} orders`} />
        <Metric
          label="Contribution profit"
          value={`$${contributionProfit.toFixed(2)}`}
          sub={`${(contributionMargin * 100).toFixed(1)}% margin`}
        />
        <Metric label="Pending supplier orders" value={String(pendingSupplierOrders)} />
        <Metric label="Orders in transit" value={String(inTransit)} />
        <Metric label="Delivered orders" value={String(delivered)} />
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-border-strong p-4 text-sm text-slate">
        Advertising cost isn&apos;t tracked yet (no ad platform is
        connected) — contribution profit above excludes it. Wire up
        Marketing → Analytics in Phase 4 to fold it in.
      </div>
    </div>
  );
}
