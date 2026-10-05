import Link from "next/link";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

const statusColor: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-red-100 text-red-700",
};

export default async function AdminOrdersPage() {
  const all = await db.select().from(orders).orderBy(desc(orders.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Orders</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Placed</th>
            </tr>
          </thead>
          <tbody>
            {all.map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.orderNumber}`} className="font-medium text-blue hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-navy">{o.fullName}</td>
                <td className="px-4 py-3 text-navy">${o.total.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusColor[o.status] ?? "bg-light text-slate"}`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate">
                  {new Date(o.createdAt ?? "").toLocaleDateString()}
                </td>
              </tr>
            ))}
            {all.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
