import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inventoryBalances, products, sales, admins } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { DISCOUNT_LIMIT_PERCENT } from "@/lib/pos";
import { PosTerminal } from "./PosTerminal";

export default async function PosPage() {
  const session = await getCurrentStaffSession();
  if (!hasPermission(session?.staffRole, "pos.sell")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Sales & POS</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to the till.</p>
      </div>
    );
  }

  const rows = await db.select().from(products).where(eq(products.fulfillmentType, "inventory"));
  const balances = await db.select().from(inventoryBalances);
  const onHand = new Map<number, number>();
  for (const b of balances) onHand.set(b.productId, (onHand.get(b.productId) ?? 0) + b.quantity);
  const items = rows
    .filter((p) => p.status === "active" && (p.sellingPrice ?? p.price ?? 0) > 0)
    .map((p) => ({
      id: p.id,
      title: p.title,
      sku: p.sku,
      price: Math.round((p.sellingPrice ?? p.price) as number),
      onHand: onHand.get(p.id) ?? 0,
    }));

  const recent = await db
    .select({
      receipt: sales.receiptNumber,
      total: sales.total,
      at: sales.createdAt,
      by: admins.name,
    })
    .from(sales)
    .leftJoin(admins, eq(admins.id, sales.employeeId))
    .orderBy(desc(sales.id))
    .limit(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Sales & POS</h1>
        <p className="mt-1 text-sm text-slate">
          Prices come from the server, not this screen. Only active SWD-stock products appear here.
        </p>
      </div>
      <PosTerminal items={items} maxDiscount={DISCOUNT_LIMIT_PERCENT[session!.staffRole] ?? 0} />

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <p className="px-4 pt-4 text-sm font-medium text-slate">Recent sales</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Cashier</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.receipt} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link className="text-blue hover:underline" href={`/admin/business-os/pos/receipt/${r.receipt}`}>{r.receipt}</Link>
                </td>
                <td className="px-4 py-3 text-slate">{r.at.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                <td className="px-4 py-3 text-navy">{r.total.toLocaleString()} UGX</td>
                <td className="px-4 py-3 text-slate">{r.by ?? "—"}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate">No sales yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
