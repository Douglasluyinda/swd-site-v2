import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { goodsReceiptItems, goodsReceipts, products, purchaseOrderItems, purchaseOrders, suppliers } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { approvePo, cancelPo, receivePoGoods } from "@/lib/admin-actions";
import { canApprovePo, remainingToReceive } from "@/lib/purchasing";

const input = "rounded-lg border border-border-strong px-2 py-1 text-sm";
const fmt = (n: number) => n.toLocaleString();

export default async function PoPage({ params }: { params: Promise<{ poNumber: string }> }) {
  const { poNumber } = await params;
  const me = await getCurrentStaffSession();
  if (!hasPermission(me?.staffRole, "suppliers.manage")) notFound();

  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.poNumber, poNumber)).limit(1);
  if (!po) notFound();
  const [sup] = await db.select().from(suppliers).where(eq(suppliers.id, po.supplierId));
  const items = await db
    .select({ id: purchaseOrderItems.id, qty: purchaseOrderItems.quantity, cost: purchaseOrderItems.unitCost, title: products.title, sku: products.sku })
    .from(purchaseOrderItems).innerJoin(products, eq(products.id, purchaseOrderItems.productId))
    .where(eq(purchaseOrderItems.poId, po.id));
  const got = await db
    .select({ id: goodsReceiptItems.poItemId, acc: sql<number>`sum(${goodsReceiptItems.quantityAccepted})::int`, rej: sql<number>`sum(${goodsReceiptItems.quantityRejected})::int` })
    .from(goodsReceiptItems).innerJoin(goodsReceipts, eq(goodsReceipts.id, goodsReceiptItems.receiptId))
    .where(eq(goodsReceipts.poId, po.id)).groupBy(goodsReceiptItems.poItemId);
  const by = new Map(got.map((g) => [g.id, g]));

  // Same rule the server enforces, so staff aren't shown a button that will be refused.
  const approveBlocked = canApprovePo({
    approverId: Number(me!.adminId), approverRole: me!.staffRole, creatorId: po.createdBy,
    total: po.total, hasPermission: hasPermission(me?.staffRole, "purchasing.approve"),
  });
  const canApprove = !approveBlocked && po.status === "PENDING_APPROVAL";
  const canReceive = hasPermission(me?.staffRole, "inventory.manage") && (po.status === "APPROVED" || po.status === "PARTIALLY_RECEIVED");
  const canCancel = po.status === "PENDING_APPROVAL" || po.status === "APPROVED";

  async function approveAction(f: FormData) { "use server"; await approvePo(f); }
  async function cancelAction(f: FormData) { "use server"; await cancelPo(f); }
  async function receiveAction(f: FormData) { "use server"; await receivePoGoods(f); }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/business-os/purchasing" className="text-sm text-blue hover:underline">← Purchasing</Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{po.poNumber}</h1>
        <p className="text-sm text-slate">{sup?.name} · {po.status} · {fmt(po.total)} {po.currency}{po.note ? ` · ${po.note}` : ""}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Ordered</th><th className="px-4 py-3 font-medium">Unit cost</th><th className="px-4 py-3 font-medium">Received</th><th className="px-4 py-3 font-medium">Rejected</th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-navy">{i.title} <span className="text-xs text-slate">{i.sku}</span></td>
                <td className="px-4 py-3">{i.qty}</td>
                <td className="px-4 py-3 text-slate">{fmt(i.cost)}</td>
                <td className="px-4 py-3">{by.get(i.id)?.acc ?? 0}</td>
                <td className="px-4 py-3 text-slate">{by.get(i.id)?.rej ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {po.status === "PENDING_APPROVAL" && approveBlocked && (
        <p className="rounded-xl border border-border bg-light p-3 text-sm text-slate">Awaiting approval. {approveBlocked}</p>
      )}
      <div className="flex gap-3">
        {canApprove && (
          <form action={approveAction}><input type="hidden" name="poNumber" value={po.poNumber} />
            <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Approve</button></form>
        )}
        {canCancel && (
          <form action={cancelAction}><input type="hidden" name="poNumber" value={po.poNumber} />
            <button className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600">Cancel order</button></form>
        )}
      </div>

      {canReceive && (
        <form action={receiveAction} className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Receive goods</p>
          <input type="hidden" name="poNumber" value={po.poNumber} />
          <div className="mt-3 space-y-2">
            {items.map((i) => {
              const left = remainingToReceive(i.qty, by.get(i.id)?.acc ?? 0);
              return (
                <div key={i.id} className="grid items-center gap-2 sm:grid-cols-[2fr_1fr_1fr_2fr]">
                  <span className="text-sm text-navy">{i.title} <span className="text-xs text-slate">(left: {left})</span></span>
                  <input name={`acc_${i.id}`} type="number" min={0} max={left} defaultValue={0} disabled={left === 0} aria-label={`Accepted ${i.title}`} className={input} />
                  <input name={`rej_${i.id}`} type="number" min={0} defaultValue={0} aria-label={`Rejected ${i.title}`} className={input} />
                  <input name={`note_${i.id}`} placeholder="Reason if rejected" className={input} />
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate">Columns: accepted · rejected · reason. Accepted units are added to stock; rejected units are recorded only.</p>
          <button className="mt-3 w-full rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Record receipt</button>
        </form>
      )}
    </div>
  );
}
