import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { admins, customerNotes, customers, repairTickets, sales } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { saveCustomer, saveCustomerNote } from "@/lib/admin-actions";
import { CHANNELS, NOTE_KINDS } from "@/lib/customers";

const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";
const stamp = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const me = await getCurrentStaffSession();
  if (!hasPermission(me?.staffRole, "customers.manage")) notFound();
  const id = Number(idParam);
  if (!Number.isInteger(id)) notFound();

  const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  if (!c) notFound();

  const history = await db.select().from(sales).where(eq(sales.customerId, id)).orderBy(desc(sales.id)).limit(50);
  const notes = await db
    .select({ id: customerNotes.id, kind: customerNotes.kind, text: customerNotes.text, at: customerNotes.createdAt, by: admins.name })
    .from(customerNotes).leftJoin(admins, eq(admins.id, customerNotes.employeeId))
    .where(eq(customerNotes.customerId, id)).orderBy(desc(customerNotes.id));
  const canSeeRepairs = hasPermission(me?.staffRole, "repairs.counter");
  const repairs = canSeeRepairs ? await db.select().from(repairTickets).where(eq(repairTickets.customerId, id)).orderBy(desc(repairTickets.id)).limit(50) : [];
  const spent = history.reduce((a, s) => a + s.total, 0);

  const timeline = [
    ...history.map((s) => ({ at: s.createdAt, kind: "SALE", text: `${s.receiptNumber} — ${s.total.toLocaleString()} UGX`, href: `/admin/business-os/pos/receipt/${s.receiptNumber}` as string | null })),
    ...repairs.map((r) => ({ at: r.createdAt, kind: "REPAIR", text: `${r.ticketNumber} — ${[r.brand, r.model].filter(Boolean).join(" ") || r.deviceType} (${r.status.replace("_", " ")})`, href: `/admin/business-os/repairs/${r.ticketNumber}` as string | null })),
    ...notes.map((n) => ({ at: n.at, kind: n.kind, text: `${n.text}${n.by ? ` — ${n.by}` : ""}`, href: null })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  async function saveAction(f: FormData) { "use server"; await saveCustomer(f); }
  async function noteAction(f: FormData) { "use server"; await saveCustomerNote(f); }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/business-os/customers" className="text-sm text-blue hover:underline">← Customers</Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{c.fullName || c.email}</h1>
        <p className="text-sm text-slate">{history.length} shop purchase{history.length === 1 ? "" : "s"} · {spent.toLocaleString()} UGX spent</p>
      </div>

      <form action={saveAction} className="rounded-xl border border-border bg-white p-5">
        <input type="hidden" name="customerId" value={c.id} />
        <p className="text-sm font-medium text-slate">Details</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input name="name" required defaultValue={c.fullName ?? ""} placeholder="Full name" className={input} />
          <input name="phone" required defaultValue={c.phone ?? ""} placeholder="Phone" className={input} />
          <input name="email" type="email" defaultValue={c.email ?? ""} placeholder="Email (optional)" className={input} />
          <input name="location" defaultValue={c.location ?? ""} placeholder="Location" className={input} />
          <select name="preferredChannel" defaultValue={c.preferredChannel ?? ""} className={input}>
            <option value="">No preferred channel</option>
            {CHANNELS.map((ch) => <option key={ch} value={ch}>{ch}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate">
            <input type="checkbox" name="marketingOptIn" defaultChecked={c.marketingOptIn} />
            Agreed to receive offers and promotions
          </label>
          <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white sm:col-span-2">Save</button>
        </div>
      </form>

      <form action={noteAction} className="rounded-xl border border-border bg-white p-5">
        <input type="hidden" name="customerId" value={c.id} />
        <p className="text-sm font-medium text-slate">Add note, complaint or warranty record</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_3fr_auto]">
          <select name="kind" className={input}>{NOTE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select>
          <input name="text" required maxLength={2000} placeholder="What happened?" className={input} />
          <button className="rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border">Add</button>
        </div>
      </form>

      <div className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">Activity</p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {timeline.map((t, i) => (
            <li key={i} className="flex gap-3 py-2">
              <span className="w-40 shrink-0 text-xs text-slate">{stamp(t.at)}</span>
              <span className="w-24 shrink-0 text-xs font-medium text-slate">{t.kind}</span>
              {t.href ? <Link className="text-blue hover:underline" href={t.href}>{t.text}</Link> : <span className="text-navy">{t.text}</span>}
            </li>
          ))}
          {timeline.length === 0 && <li className="py-6 text-center text-slate">Nothing yet.</li>}
        </ul>
        <p className="mt-3 text-xs text-slate">Shows shop sales and repair tickets linked by phone.</p>
      </div>
    </div>
  );
}
