import { db } from "@/lib/db/client";
import { shippingRates } from "@/lib/db/schema";
import { createShippingRate, deleteShippingRate } from "@/lib/admin-actions";
import { desc } from "drizzle-orm";

export default async function AdminShippingPage() {
  const all = await db.select().from(shippingRates).orderBy(desc(shippingRates.id));

  async function createShippingRateAction(formData: FormData) {
    "use server";
    await createShippingRate(formData);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Shipping</h1>
        <p className="mt-1 max-w-xl text-sm text-slate">
          A region here is matched against each order&apos;s entered city, then country —
          &ldquo;Entebbe&rdquo; overrides delivery cost for Entebbe orders specifically; a
          broader &ldquo;Uganda&rdquo; row acts as a fallback for any other city. When no region matches an
          order&apos;s address, checkout falls back to summing each product&apos;s own
          shipping cost (Admin → Products), same as before this existed. No rates are
          pre-filled — add the real Entebbe fee (and any others) once they&apos;re
          confirmed; nothing here should be guessed at.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Region</th>
              <th className="px-4 py-3 font-medium">Delivery fee</th>
              <th className="px-4 py-3 font-medium">Estimated days</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium text-navy">{r.region}</td>
                <td className="px-4 py-3 text-slate">${r.cost.toFixed(2)}</td>
                <td className="px-4 py-3 text-slate">{r.estimatedDays ?? "—"}</td>
                <td className="px-4 py-3">
                  <form action={async () => { "use server"; await deleteShippingRate(String(r.id)); }}>
                    <button className="text-sm text-red-600 hover:underline">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {all.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate">
                  No delivery regions configured — every order uses per-product shipping cost.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="max-w-xl rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">Add delivery region</p>
        <form action={createShippingRateAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            name="region"
            placeholder="Region (e.g. Entebbe, or Uganda for a fallback)"
            required
            className="rounded-lg border border-border-strong px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="cost"
            type="number"
            step="0.01"
            min="0"
            placeholder="Delivery fee ($)"
            required
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <input
            name="estimatedDays"
            placeholder="Estimated delivery (e.g. 1-2 days) — optional"
            className="rounded-lg border border-border-strong px-3 py-2 text-sm"
          />
          <button className="sm:col-span-2 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">
            Add region
          </button>
        </form>
      </div>
    </div>
  );
}
