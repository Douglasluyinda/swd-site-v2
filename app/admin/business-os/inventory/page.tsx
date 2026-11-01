import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inventoryBalances, inventoryMovements, products, admins } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { recordStockMovement } from "@/lib/admin-actions";
import { MANUAL_MOVEMENT_TYPES, isLowStock } from "@/lib/inventory-ledger";

export default async function InventoryPage() {
  const session = await getCurrentStaffSession();
  if (!hasPermission(session?.staffRole, "inventory.view")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Inventory</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to inventory.</p>
      </div>
    );
  }
  const canManage = hasPermission(session?.staffRole, "inventory.manage");

  const stocked = await db
    .select()
    .from(products)
    .where(eq(products.fulfillmentType, "inventory"))
    .orderBy(products.title);
  const balances = await db.select().from(inventoryBalances);
  const onHand = new Map<number, number>();
  for (const b of balances) onHand.set(b.productId, (onHand.get(b.productId) ?? 0) + b.quantity);

  const movements = await db
    .select({
      id: inventoryMovements.id,
      createdAt: inventoryMovements.createdAt,
      title: products.title,
      type: inventoryMovements.movementType,
      change: inventoryMovements.quantityChange,
      after: inventoryMovements.balanceAfter,
      reference: inventoryMovements.reference,
      note: inventoryMovements.note,
      employee: admins.name,
    })
    .from(inventoryMovements)
    .innerJoin(products, eq(products.id, inventoryMovements.productId))
    .leftJoin(admins, eq(admins.id, inventoryMovements.employeeId))
    .orderBy(desc(inventoryMovements.id))
    .limit(50);

  let valuation = 0;
  for (const p of stocked) valuation += (onHand.get(p.id) ?? 0) * (p.costPrice ?? p.supplierCost ?? 0);
  const lowCount = stocked.filter((p) => isLowStock(onHand.get(p.id) ?? 0, p.reorderLevel)).length;

  async function moveAction(formData: FormData) {
    "use server";
    await recordStockMovement(formData);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Inventory</h1>
        <p className="mt-1 text-sm text-slate">
          Every stock change is an immutable ledger entry. Quantities below are the ledger&apos;s running
          balances, not hand-edited numbers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-slate">Stocked products</p>
          <p className="mt-1 text-2xl font-semibold text-navy">{stocked.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-slate">Low stock</p>
          <p className="mt-1 text-2xl font-semibold text-navy">{lowCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-slate">Stock value (at cost)</p>
          <p className="mt-1 text-2xl font-semibold text-navy">{valuation.toLocaleString()} UGX</p>
          <p className="text-xs text-slate">Products with no cost recorded count as 0.</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">On hand</th>
              <th className="px-4 py-3 font-medium">Reorder at</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {stocked.map((p) => {
              const q = onHand.get(p.id) ?? 0;
              const low = isLowStock(q, p.reorderLevel);
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-navy">{p.title}</td>
                  <td className="px-4 py-3 text-slate">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-navy">{q}</td>
                  <td className="px-4 py-3 text-slate">{p.reorderLevel ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${low ? "bg-red-50 text-red-600" : "bg-light text-slate"}`}>
                      {q === 0 ? "Out of stock" : low ? "Low" : "OK"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {stocked.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  No SWD-inventory products yet. Add them under Products.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && stocked.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Record stock movement</p>
          <form action={moveAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <select name="productId" required className="rounded-lg border border-border-strong px-3 py-2 text-sm">
              {stocked.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.sku})</option>
              ))}
            </select>
            <select name="movementType" required className="rounded-lg border border-border-strong px-3 py-2 text-sm">
              {MANUAL_MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <input name="quantity" type="number" min={1} step={1} placeholder="Quantity" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="unitCost" type="number" min={0} step="0.01" placeholder="Unit cost (optional)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="reference" placeholder="Reference (PO, invoice…)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <input name="note" placeholder="Reason (required for adjustment/damage/loss)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
            <button className="sm:col-span-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Record movement</button>
          </form>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <p className="px-4 pt-4 text-sm font-medium text-slate">Recent movements</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Change</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">By</th>
              <th className="px-4 py-3 font-medium">Ref / reason</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-slate">{m.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                <td className="px-4 py-3 text-navy">{m.title}</td>
                <td className="px-4 py-3 text-slate">{m.type}</td>
                <td className="px-4 py-3 font-medium text-navy">{m.change > 0 ? `+${m.change}` : m.change}</td>
                <td className="px-4 py-3 text-slate">{m.after}</td>
                <td className="px-4 py-3 text-slate">{m.employee ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{[m.reference, m.note].filter(Boolean).join(" — ") || "—"}</td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate">No movements yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
