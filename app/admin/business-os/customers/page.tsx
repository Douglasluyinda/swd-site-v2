import Link from "next/link";
import { desc, ilike, isNotNull, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { registerCustomer } from "@/lib/admin-actions";

const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await getCurrentStaffSession();
  if (!hasPermission(me?.staffRole, "customers.manage")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Customers</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to customer records.</p>
      </div>
    );
  }
  const { q = "" } = await searchParams;
  const term = q.trim().replace(/[%_]/g, "\\$&");
  const rows = await db
    .select()
    .from(customers)
    .where(term
      ? or(ilike(customers.fullName, `%${term}%`), ilike(customers.phone, `%${term}%`), ilike(customers.email, `%${term}%`))
      : isNotNull(customers.phoneNormalized))
    .orderBy(desc(customers.id))
    .limit(50);

  async function registerAction(f: FormData) { "use server"; await registerCustomer(f); }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Customers</h1>
        <p className="mt-1 text-sm text-slate">
          Walk-ins only need a name and phone. Without a search, this lists customers registered at the shop;
          searching also finds online-checkout customers.
        </p>
      </div>

      <form className="flex gap-3" action="/admin/business-os/customers">
        <input name="q" defaultValue={q} placeholder="Search name, phone or email" aria-label="Search customers" className={`${input} flex-1`} />
        <button className="rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border">Search</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">Email</th><th className="px-4 py-3 font-medium">Location</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3"><Link className="text-blue hover:underline" href={`/admin/business-os/customers/${c.id}`}>{c.fullName || c.email || `Customer ${c.id}`}</Link></td>
                <td className="px-4 py-3 text-slate">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{c.email ?? "—"}</td>
                <td className="px-4 py-3 text-slate">{c.location ?? "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>

      <form action={registerAction} className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">Register customer</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="name" required placeholder="Full name" className={input} />
          <input name="phone" required placeholder="Phone (e.g. 0772 123456)" className={input} />
          <input name="email" type="email" placeholder="Email (optional)" className={input} />
          <input name="location" placeholder="Location (optional)" className={input} />
          <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white sm:col-span-2">Register</button>
        </div>
        <p className="mt-2 text-xs text-slate">Registering an existing phone number just opens that customer — no duplicates.</p>
      </form>
    </div>
  );
}
