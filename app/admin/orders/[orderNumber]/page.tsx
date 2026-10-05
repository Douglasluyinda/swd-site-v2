import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { fulfillments, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getOrderByNumber } from "@/lib/orders-query";
import { calculateProfit } from "@/lib/profit";
import {
  addTrackingInfo,
  sendToSupplier,
  updateOrderStatus,
} from "@/lib/admin-actions";

const statuses = [
  "NEW", "PAYMENT_PENDING", "PAID", "SUPPLIER_ORDER_PENDING", "SUPPLIER_ORDERED",
  "PROCESSING", "SHIPPED", "IN_TRANSIT", "DELIVERED", "CANCELLED",
  "REFUND_PENDING", "REFUNDED", "FULFILLMENT_DELAYED", "OUT_OF_STOCK",
];

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const data = await getOrderByNumber(orderNumber);
  if (!data) notFound();
  const { order, items, events } = data;

  const orderPayments = await db.select().from(payments).where(eq(payments.orderId, order.id));
  const [fulfillment] = await db
    .select()
    .from(fulfillments)
    .where(eq(fulfillments.orderId, order.id))
    .limit(1);

  const supplierCostTotal = items.reduce((sum, i) => sum + i.unitSupplierCost * i.quantity, 0);

  const profit = calculateProfit({
    sellingPrice: order.subtotal,
    customerShipping: order.shippingTotal,
    supplierCost: supplierCostTotal,
    supplierShipping: fulfillment?.supplierCost ?? 0,
  });

  async function updateStatusAction(formData: FormData) {
    "use server";
    const status = formData.get("status") as string;
    await updateOrderStatus(order.id, status);
  }

  async function sendToSupplierAction(formData: FormData) {
    "use server";
    const ref = formData.get("supplierOrderRef") as string;
    const cost = parseFloat(formData.get("supplierCost") as string);
    await sendToSupplier(order.id, ref, cost);
  }

  async function addTrackingAction(formData: FormData) {
    "use server";
    await addTrackingInfo(
      order.id,
      formData.get("trackingNumber") as string,
      formData.get("carrier") as string,
      formData.get("trackingUrl") as string,
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-blue">{order.status}</p>
        <h1 className="text-2xl font-semibold text-navy">{order.orderNumber}</h1>
        <p className="text-sm text-slate">
          {order.fullName} &middot; {order.email} &middot; {order.phone}
        </p>
        <p className="text-sm text-slate">
          {order.address}, {order.city}, {order.country}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Items</p>
          <ul className="mt-3 divide-y divide-border text-sm">
            {items.map((i, idx) => (
              <li key={idx} className="flex justify-between py-2">
                <span>{i.title} x {i.quantity}</span>
                <span>${(i.unitPrice * i.quantity).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-slate"><span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-slate"><span>Shipping</span><span>${order.shippingTotal.toFixed(2)}</span></div>
            <div className="flex justify-between font-semibold text-navy"><span>Total</span><span>${order.total.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Payments</p>
          <ul className="mt-3 space-y-2 text-sm">
            {orderPayments.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.provider} &middot; {p.txRef.slice(0, 20)}…</span>
                <span className={p.status === "successful" ? "text-green-700" : "text-slate"}>
                  {p.status}
                </span>
              </li>
            ))}
            {orderPayments.length === 0 && <li className="text-slate">No payment attempts yet.</li>}
          </ul>

          <p className="mt-4 text-sm font-medium text-slate">Contribution estimate</p>
          <p className="mt-1 text-sm text-slate">
            Gross margin: ${profit.grossMargin.toFixed(2)}
            {fulfillment?.supplierCost
              ? " (includes supplier shipping cost from fulfillment)"
              : " (supplier shipping cost not yet entered — send to supplier to record it)"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Update status</p>
          <form action={updateStatusAction} className="mt-3 flex gap-2">
            <select
              key={order.status}
              name="status"
              defaultValue={order.status}
              className="flex-1 rounded-lg border border-border-strong px-3 py-2 text-sm"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white">
              Save
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Send to supplier</p>
          <form action={sendToSupplierAction} className="mt-3 space-y-2">
            <input
              name="supplierOrderRef"
              placeholder="Supplier order reference"
              defaultValue={fulfillment?.supplierOrderRef ?? ""}
              className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            />
            <input
              name="supplierCost"
              type="number"
              step="0.01"
              placeholder="Supplier cost"
              defaultValue={fulfillment?.supplierCost ?? ""}
              className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            />
            <button className="w-full rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white">
              Send to Supplier
            </button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">Tracking & carrier</p>
        <form action={addTrackingAction} className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            name="trackingNumber"
            placeholder="Tracking number"
            defaultValue={fulfillment?.trackingNumber ?? ""}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <input
            name="carrier"
            placeholder="Carrier"
            defaultValue={fulfillment?.carrier ?? ""}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <input
            name="trackingUrl"
            placeholder="Tracking URL"
            defaultValue={fulfillment?.trackingUrl ?? ""}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <button className="sm:col-span-3 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Mark shipped with this tracking info
          </button>
        </form>

        <p className="mt-5 text-sm font-medium text-slate">Event log</p>
        <ul className="mt-2 space-y-1 text-sm text-slate">
          {events.map((e) => (
            <li key={e.id}>
              {e.status} — {new Date(e.occurredAt ?? "").toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
