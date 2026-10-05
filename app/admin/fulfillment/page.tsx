import { db } from "@/lib/db/client";
import { fulfillments, orders } from "@/lib/db/schema";
import Link from "next/link";

export default async function AdminFulfillmentPage() {
  const all = await db.select().from(fulfillments);
  const orderMap = new Map((await db.select().from(orders)).map((o) => [o.id, o]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Fulfillment</h1>
      <p className="mt-1 text-sm text-slate">
        Manual fulfillment for Phase 2. Automated supplier API integration comes in Phase 3.
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Supplier ref</th>
              <th className="px-4 py-3 font-medium">Cost</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Tracking</th>
            </tr>
          </thead>
          <tbody>
            {all.map((f) => {
              const order = orderMap.get(f.orderId);
              return (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    {order && (
                      <Link href={`/admin/orders/${order.orderNumber}`} className="text-blue hover:underline">
                        {order.orderNumber}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate">{f.supplierOrderRef ?? "—"}</td>
                  <td className="px-4 py-3 text-navy">{f.supplierCost ? `$${f.supplierCost.toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-3 text-slate">{f.status}</td>
                  <td className="px-4 py-3 text-slate">{f.trackingNumber ?? "—"}</td>
                </tr>
              );
            })}
            {all.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate">No fulfillments sent yet — use &quot;Send to Supplier&quot; on an order.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
