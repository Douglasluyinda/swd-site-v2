import { db } from "@/lib/db/client";
import { suppliers } from "@/lib/db/schema";
import { createSupplier } from "@/lib/admin-actions";

export default async function AdminSuppliersPage() {
  const all = await db.select().from(suppliers);

  async function createSupplierAction(formData: FormData) {
    "use server";
    await createSupplier(formData);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Suppliers</h1>
        <p className="mt-1 text-sm text-slate">
          Supplier payment is handled by SWD directly (via the &quot;Send to
          Supplier&quot; action on an order) — never through the customer
          payment gateway.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Supplier</th>
              <th className="px-4 py-3 font-medium">Country</th>
              <th className="px-4 py-3 font-medium">Processing time</th>
              <th className="px-4 py-3 font-medium">Reliability</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {all.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-navy">{s.name}</td>
                <td className="px-4 py-3 text-slate">{s.country}</td>
                <td className="px-4 py-3 text-slate">{s.processingTimeDays} days</td>
                <td className="px-4 py-3 text-slate">{s.reliabilityScore}/5</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-light px-2 py-0.5 text-xs text-slate">
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {all.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate">
                  No suppliers yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">Add supplier</p>
        <form action={createSupplierAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="name" placeholder="Supplier name" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input name="country" placeholder="Country" required className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input name="contact" placeholder="Contact (email/phone)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input name="website" placeholder="Website" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input name="processingTimeDays" type="number" placeholder="Processing time (days)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input name="returnPolicy" placeholder="Return policy summary" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <button className="sm:col-span-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Add supplier
          </button>
        </form>
      </div>
    </div>
  );
}
