import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { products, purchaseOrders, suppliers } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { getSupplierBalance } from "@/lib/purchase-orders";
import { addSupplierInvoice, addSupplierPayment } from "@/lib/admin-actions";
import { NewPoForm } from "./NewPoForm";

const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";
const fmt = (n: number) => n.toLocaleString();

export default async function PurchasingPage() {
  const me = await getCurrentStaffSession();
  if (!hasPermission(me?.staffRole, "suppliers.manage")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Suppliers & Purchasing</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to purchasing.</p>
      </div>
    );
  }
  const canPay = hasPermission(me?.staffRole, "purchasing.approve");

  const sups = await db.select().from(suppliers).orderBy(suppliers.name);
  const stocked = await db.select({ id: products.id, title: products.title, sku: products.sku })
    .from(products).where(eq(products.fulfillmentType, "inventory")).orderBy(products.title);
  const pos = await db
    .select({ poNumber: purchaseOrders.poNumber, status: purchaseOrders.status, total: purchaseOrders.total, at: purchaseOrders.createdAt, supplier: suppliers.name })
    .from(purchaseOrders).innerJoin(suppliers, eq(suppliers.id, purchaseOrders.supplierId))
    .orderBy(desc(purchaseOrders.id)).limit(40);
  const balances = await Promise.all(sups.map(async (s) => ({ s, ...(await getSupplierBalance(db, s.id)) })));

  async function invoiceAction(f: FormData) { "use server"; await addSupplierInvoice(f); }
  async function payAction(f: FormData) { "use server"; await addSupplierPayment(f); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Suppliers & Purchasing</h1>
        <p className="mt-1 text-sm text-slate">
          A purchase order never changes stock — only receiving goods does. Supplier payments are recorded here by
          SWD, never through the customer payment gateway. The dropshipping supplier directory is at{" "}
          <Link href="/admin/suppliers" className="text-blue hover:underline">Suppliers</Link>.
        </p>
      </div>

      {sups.length > 0 && stocked.length > 0 ? (
        <NewPoForm suppliers={sups.map((s) => ({ id: s.id, name: s.name }))} products={stocked} />
      ) : (
        <p className="rounded-xl border border-border bg-light p-4 text-sm text-slate">
          Add at least one supplier and one SWD-stock product before creating purchase orders.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <p className="px-4 pt-4 text-sm font-medium text-slate">Purchase orders</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr><th className="px-4 py-3 font-medium">PO</th><th className="px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Total (UGX)</th></tr>
          </thead>
          <tbody>
            {pos.map((p) => (
              <tr key={p.poNumber} className="border-b border-border last:border-0">
                <td className="px-4 py-3"><Link className="text-blue hover:underline" href={`/admin/business-os/purchasing/${p.poNumber}`}>{p.poNumber}</Link></td>
                <td className="px-4 py-3 text-navy">{p.supplier}</td>
                <td className="px-4 py-3 text-slate">{p.status}</td>
                <td className="px-4 py-3 text-navy">{fmt(p.total)}</td>
              </tr>
            ))}
            {pos.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate">No purchase orders yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <p className="px-4 pt-4 text-sm font-medium text-slate">Supplier balances</p>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr><th className="px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3 font-medium">Invoiced</th><th className="px-4 py-3 font-medium">Paid</th><th className="px-4 py-3 font-medium">Outstanding</th></tr>
          </thead>
          <tbody>
            {balances.map((b) => (
              <tr key={b.s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-navy">{b.s.name}</td>
                <td className="px-4 py-3 text-slate">{fmt(b.invoiced)}</td>
                <td className="px-4 py-3 text-slate">{fmt(b.paid)}</td>
                <td className="px-4 py-3 font-medium text-navy">{fmt(b.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sups.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form action={invoiceAction} className="rounded-xl border border-border bg-white p-5">
            <p className="text-sm font-medium text-slate">Record supplier invoice</p>
            <div className="mt-3 grid gap-3">
              <select name="supplierId" className={input}>{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input name="invoiceNumber" required placeholder="Invoice number" className={input} />
              <input name="amount" type="number" min={1} required placeholder="Amount (UGX)" className={input} />
              <input name="poNumber" placeholder="PO number (optional)" className={input} />
              <input name="dueDate" type="date" className={input} />
              <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Record invoice</button>
            </div>
          </form>
          {canPay ? (
            <form action={payAction} className="rounded-xl border border-border bg-white p-5">
              <p className="text-sm font-medium text-slate">Record supplier payment</p>
              <div className="mt-3 grid gap-3">
                <select name="supplierId" className={input}>{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <input name="amount" type="number" min={1} required placeholder="Amount (UGX)" className={input} />
                <select name="method" className={input}><option>BANK_TRANSFER</option><option>CASH</option><option>MOBILE_MONEY</option></select>
                <input name="reference" placeholder="Reference" className={input} />
                <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Record payment</button>
              </div>
              <p className="mt-2 text-xs text-slate">Records a payment already made; it can&apos;t exceed the outstanding balance.</p>
            </form>
          ) : (
            <p className="rounded-xl border border-border bg-light p-5 text-sm text-slate">Only a manager or owner can record supplier payments.</p>
          )}
        </div>
      )}
    </div>
  );
}
