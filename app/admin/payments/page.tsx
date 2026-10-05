import { db } from "@/lib/db/client";
import { payments } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export default async function AdminPaymentsPage() {
  const all = await db.select().from(payments).orderBy(desc(payments.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Payments</h1>
      <p className="mt-1 text-sm text-slate">
        Every attempt is recorded here, verified server-side against Flutterwave — never trusted from the checkout redirect alone.
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Verified</th>
            </tr>
          </thead>
          <tbody>
            {all.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-navy">{p.txRef}</td>
                <td className="px-4 py-3 text-slate">{p.provider}</td>
                <td className="px-4 py-3 text-navy">{p.currency} {p.amount.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "successful" ? "bg-green-100 text-green-800" : p.status === "failed" ? "bg-red-100 text-red-700" : "bg-light text-slate"}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate">
                  {p.verifiedAt ? new Date(p.verifiedAt).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
            {all.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate">No payment attempts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
