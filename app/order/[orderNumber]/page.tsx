import { notFound } from "next/navigation";
import { getOrderByNumber } from "@/lib/orders-query";
import { OrderVerifyOnReturn } from "@/components/OrderVerifyOnReturn";
import { Suspense } from "react";

const statusLabel: Record<string, string> = {
  NEW: "New",
  PAYMENT_PENDING: "Awaiting payment",
  PAID: "Payment confirmed",
  SUPPLIER_ORDER_PENDING: "Preparing supplier order",
  SUPPLIER_ORDERED: "Ordered from supplier",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  FULFILLMENT_DELAYED: "Delayed",
  OUT_OF_STOCK: "Out of stock",
};

const timelineSteps = [
  { key: "order_received", label: "Order received" },
  { key: "payment_confirmed", label: "Payment confirmed" },
  { key: "supplier_processing", label: "Supplier processing" },
  { key: "shipped", label: "Shipped" },
  { key: "in_transit", label: "In transit" },
  { key: "out_for_delivery", label: "Out for delivery" },
  { key: "delivered", label: "Delivered" },
];

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const data = await getOrderByNumber(orderNumber);
  if (!data) notFound();

  const { order, items, events } = data;
  const reachedKeys = new Set(events.map((e) => e.status));

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <Suspense fallback={null}>
        <OrderVerifyOnReturn orderNumber={orderNumber} />
      </Suspense>

      <p className="text-sm font-medium text-blue">Order {order.orderNumber}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy">
        {statusLabel[order.status] ?? order.status}
      </h1>
      <p className="mt-2 text-slate">
        A confirmation has been sent to {order.email}.
      </p>

      <div className="mt-10 rounded-xl border border-border bg-white p-6">
        <p className="text-sm font-medium text-slate">Tracking</p>
        <ol className="mt-4 space-y-3">
          {timelineSteps.map((step) => {
            const reached = reachedKeys.has(step.key);
            return (
              <li key={step.key} className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    reached ? "bg-blue" : "bg-border-strong"
                  }`}
                />
                <span className={reached ? "text-navy" : "text-slate"}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-white p-6">
        <p className="text-sm font-medium text-slate">Items</p>
        <ul className="mt-4 divide-y divide-border">
          {items.map((item, i) => (
            <li key={i} className="flex justify-between py-2.5 text-[15px]">
              <span className="text-navy">
                {item.title} × {item.quantity}
              </span>
              <span className="text-slate">
                ${(item.unitPrice * item.quantity).toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-[15px]">
          <div className="flex justify-between text-slate">
            <span>Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate">
            <span>Shipping</span>
            <span>${order.shippingTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold text-navy">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
