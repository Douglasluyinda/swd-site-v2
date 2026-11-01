import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { admins, saleItems, salePayments, saleReturnItems, saleReturns, sales } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { processReturn } from "@/lib/admin-actions";
import { returnableQuantity } from "@/lib/pos";
import { PrintButton } from "./PrintButton";

export default async function ReceiptPage({ params }: { params: Promise<{ receiptNumber: string }> }) {
  const { receiptNumber } = await params;
  const session = await getCurrentStaffSession();
  if (!hasPermission(session?.staffRole, "pos.sell")) notFound();

  const [sale] = await db.select().from(sales).where(eq(sales.receiptNumber, receiptNumber)).limit(1);
  if (!sale) notFound();

  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, sale.id));
  const [pay] = await db.select().from(salePayments).where(eq(salePayments.saleId, sale.id)).limit(1);
  const [cashier] = await db.select({ name: admins.name }).from(admins).where(eq(admins.id, sale.employeeId));
  const returns = await db.select().from(saleReturns).where(eq(saleReturns.saleId, sale.id));
  const prior = await db
    .select({ saleItemId: saleReturnItems.saleItemId, qty: sql<number>`sum(${saleReturnItems.quantity})::int` })
    .from(saleReturnItems)
    .innerJoin(saleReturns, eq(saleReturns.id, saleReturnItems.returnId))
    .where(eq(saleReturns.saleId, sale.id))
    .groupBy(saleReturnItems.saleItemId);
  const returned = new Map(prior.map((r) => [r.saleItemId, r.qty]));
  const refunded = returns.reduce((a, r) => a + r.refundTotal, 0);
  const canRefund = hasPermission(session?.staffRole, "pos.refund");

  async function returnAction(formData: FormData) {
    "use server";
    await processReturn(formData);
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="rounded-xl border border-border bg-white p-6 text-sm print:border-0">
        <p className="text-center text-base font-semibold text-navy">SWD — Smart Devices & Digital Services</p>
        <p className="text-center text-xs text-slate">Technology. Simplified.</p>
        <p className="mt-4 font-medium text-navy">{sale.receiptNumber}</p>
        <p className="text-xs text-slate">
          {sale.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC · Served by {cashier?.name ?? "—"}
        </p>
        {(sale.customerName || sale.customerPhone) && (
          <p className="text-xs text-slate">{[sale.customerName, sale.customerPhone].filter(Boolean).join(" · ")}</p>
        )}
        <table className="mt-4 w-full">
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td className="py-1 text-navy">{i.quantity} × {i.title}</td>
                <td className="py-1 text-right">{(i.quantity * i.unitPrice).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1 border-t border-border pt-3">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{sale.subtotal.toLocaleString()}</dd></div>
          {sale.discountAmount > 0 && (
            <div className="flex justify-between"><dt>Discount ({sale.discountPercent}%)</dt><dd>-{sale.discountAmount.toLocaleString()}</dd></div>
          )}
          <div className="flex justify-between font-semibold text-navy"><dt>Total ({sale.currency})</dt><dd>{sale.total.toLocaleString()}</dd></div>
          {pay && (
            <>
              <div className="flex justify-between text-slate"><dt>{pay.method} tendered</dt><dd>{(pay.tendered ?? pay.amount).toLocaleString()}</dd></div>
              <div className="flex justify-between text-slate"><dt>Change</dt><dd>{((pay.tendered ?? pay.amount) - pay.amount).toLocaleString()}</dd></div>
            </>
          )}
          {refunded > 0 && (
            <div className="flex justify-between text-red-600"><dt>Refunded</dt><dd>-{refunded.toLocaleString()}</dd></div>
          )}
        </dl>
        <p className="mt-4 text-center text-xs text-slate">Thank you for shopping with SWD.</p>
      </div>
      <PrintButton />

      {canRefund && (
        <form action={returnAction} className="rounded-xl border border-border bg-white p-5 print:hidden">
          <p className="text-sm font-medium text-slate">Return items (manager/owner)</p>
          <input type="hidden" name="receiptNumber" value={sale.receiptNumber} />
          <div className="mt-3 space-y-2">
            {items.map((i) => {
              const max = returnableQuantity(i.quantity, returned.get(i.id) ?? 0);
              return (
                <label key={i.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-navy">{i.title} <span className="text-xs text-slate">(returnable: {max})</span></span>
                  <input type="number" name={`qty_${i.id}`} min={0} max={max} defaultValue={0} disabled={max === 0}
                    className="w-20 rounded-lg border border-border-strong px-2 py-1 text-sm" />
                </label>
              );
            })}
          </div>
          <input name="reason" required placeholder="Reason for return" className="mt-3 w-full rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <button className="mt-3 w-full rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Process return</button>
        </form>
      )}
    </div>
  );
}
