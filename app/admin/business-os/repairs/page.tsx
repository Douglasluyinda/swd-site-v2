import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, repairTickets } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { createRepairTicket } from "@/lib/admin-actions";
import { ActionForm } from "@/components/ActionForm";
import { REPAIR_STATUSES } from "@/lib/repairs";

const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";
const OPEN = REPAIR_STATUSES.filter((s) => s !== "COLLECTED" && s !== "CANCELLED");

export default async function RepairsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const me = await getCurrentStaffSession();
  const manage = hasPermission(me?.staffRole, "repairs.manage");
  const counter = hasPermission(me?.staffRole, "repairs.counter");
  const update = hasPermission(me?.staffRole, "repairs.update");
  if (!me || !(manage || counter || update)) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Repairs</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to repairs.</p>
      </div>
    );
  }
  const { status } = await searchParams;
  const wanted = status && (REPAIR_STATUSES as readonly string[]).includes(status) ? [status] : status === "all" ? [...REPAIR_STATUSES] : [...OPEN];
  // Technicians (no manage/counter) see only tickets assigned to them.
  const mineOnly = update && !manage && !counter;
  const rows = await db
    .select({ t: repairTickets, customer: customers.fullName, phone: customers.phone })
    .from(repairTickets).innerJoin(customers, eq(customers.id, repairTickets.customerId))
    .where(and(inArray(repairTickets.status, wanted), mineOnly ? eq(repairTickets.technicianId, Number(me.adminId)) : undefined))
    .orderBy(desc(repairTickets.id)).limit(100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Repairs</h1>
        <p className="mt-1 text-sm text-slate">{mineOnly ? "Tickets assigned to you." : "Open tickets, newest first."}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link className="rounded-full bg-light px-3 py-1 text-navy hover:bg-border" href="/admin/business-os/repairs">Open</Link>
        <Link className="rounded-full bg-light px-3 py-1 text-navy hover:bg-border" href="/admin/business-os/repairs?status=all">All</Link>
        {REPAIR_STATUSES.map((s) => (
          <Link key={s} className="rounded-full bg-light px-3 py-1 text-slate hover:bg-border" href={`/admin/business-os/repairs?status=${s}`}>{s.replace("_", " ")}</Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr><th className="px-4 py-3 font-medium">Ticket</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Device</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Received</th></tr>
          </thead>
          <tbody>
            {rows.map(({ t, customer, phone }) => (
              <tr key={t.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3"><Link className="text-blue hover:underline" href={`/admin/business-os/repairs/${t.ticketNumber}`}>{t.ticketNumber}</Link></td>
                <td className="px-4 py-3 text-slate">{customer ?? "—"} <span className="text-xs">{phone}</span></td>
                <td className="px-4 py-3 text-slate">{[t.brand, t.model].filter(Boolean).join(" ") || t.deviceType}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-light px-2 py-0.5 text-xs font-medium text-navy">{t.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-slate">{t.createdAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate">No tickets here.</td></tr>}
          </tbody>
        </table>
      </div>

      {counter && (
        <ActionForm action={createRepairTicket} className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Book in a device</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="name" required placeholder="Customer name" className={input} />
            <input name="phone" required placeholder="Customer phone" className={input} />
            <input name="deviceType" required placeholder="Device (phone, laptop, …)" className={input} />
            <input name="imei" placeholder="IMEI / serial (optional)" className={input} />
            <input name="brand" placeholder="Brand" className={input} />
            <input name="model" placeholder="Model" className={input} />
            <textarea name="issue" required maxLength={2000} placeholder="What is wrong?" className={`${input} sm:col-span-2`} />
            <textarea name="intakeNotes" maxLength={2000} placeholder="Condition on arrival, accessories left (optional)" className={`${input} sm:col-span-2`} />
            <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white sm:col-span-2">Book in</button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
