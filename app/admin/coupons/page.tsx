import { db } from "@/lib/db/client";
import { coupons } from "@/lib/db/schema";
import { createCoupon, toggleCouponActive } from "@/lib/admin-actions";
import { desc } from "drizzle-orm";

export default async function AdminCouponsPage() {
  const all = await db.select().from(coupons).orderBy(desc(coupons.id));

  async function createCouponAction(formData: FormData) {
    "use server";
    await createCoupon(formData);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Coupons</h1>
        <p className="mt-1 text-sm text-slate">
          Applied at checkout by code. Percent-off and amount-off are mutually exclusive per coupon.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium">Expires</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-navy">{c.code}</td>
                <td className="px-4 py-3 text-slate">
                  {c.percentOff ? `${c.percentOff}% off` : c.amountOff ? `$${c.amountOff.toFixed(2)} off` : "—"}
                </td>
                <td className="px-4 py-3 text-slate">
                  {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : "Never"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${c.active ? "bg-green-100 text-green-800" : "bg-light text-slate"}`}>
                    {c.active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action={async () => { "use server"; await toggleCouponActive(c.id, !c.active); }}>
                    <button className="text-sm text-blue hover:underline">
                      {c.active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {all.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate">No coupons yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="max-w-xl rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">Create coupon</p>
        <form action={createCouponAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="code" placeholder="CODE (e.g. WELCOME10)" required className="rounded-lg border border-border-strong px-3 py-2 text-sm uppercase" />
          <input name="expiresAt" type="date" placeholder="Expires (optional)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input name="percentOff" type="number" placeholder="Percent off (e.g. 10)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input name="amountOff" type="number" step="0.01" placeholder="Or amount off ($)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <button className="sm:col-span-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Create coupon
          </button>
        </form>
      </div>
    </div>
  );
}
