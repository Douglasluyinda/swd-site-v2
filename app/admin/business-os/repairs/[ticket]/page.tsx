import Link from "next/link";
import { and, asc, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { admins, customers, products, repairEvents, repairParts, repairPayments, repairTickets } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import {
  answerRepairQuote, assignRepairTechnician, collectRepair, fitRepairPart, moveRepairStatus, quoteRepair, saveRepairDiagnosis,
} from "@/lib/admin-actions";
import { ActionForm } from "@/components/ActionForm";
import { repairMargin, type RepairStatus } from "@/lib/repairs";

const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";
const btn = "rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border";
const fmt = (n: number) => n.toLocaleString();
const stamp = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

function Move({ id, to, label, askNote }: { id: number; to: string; label: string; askNote?: string }) {
  return (
    <ActionForm action={moveRepairStatus} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="ticketId" value={id} />
      <input type="hidden" name="to" value={to} />
      {askNote && <input name="note" required placeholder={askNote} className={`${input} w-64`} />}
      <button className={btn}>{label}</button>
    </ActionForm>
  );
}

export default async function TicketPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket: number } = await params;
  const me = await getCurrentStaffSession();
  const manage = hasPermission(me?.staffRole, "repairs.manage");
  const counter = hasPermission(me?.staffRole, "repairs.counter");
  const update = hasPermission(me?.staffRole, "repairs.update");
  if (!me || !(manage || counter || update)) notFound();
  const myId = Number(me.adminId);

  const [t] = await db.select().from(repairTickets).where(eq(repairTickets.ticketNumber, number)).limit(1);
  if (!t) notFound();
  // Technicians only see their own tickets.
  if (!manage && !counter && t.technicianId !== myId) notFound();

  const [cust] = await db.select().from(customers).where(eq(customers.id, t.customerId)).limit(1);
  const [tech] = t.technicianId ? await db.select().from(admins).where(eq(admins.id, t.technicianId)).limit(1) : [];
  const events = await db
    .select({ e: repairEvents, by: admins.name, byEmail: admins.email })
    .from(repairEvents).leftJoin(admins, eq(admins.id, repairEvents.employeeId))
    .where(eq(repairEvents.ticketId, t.id)).orderBy(desc(repairEvents.id));
  const parts = await db
    .select({ p: repairParts, title: products.title })
    .from(repairParts).innerJoin(products, eq(products.id, repairParts.productId)).where(eq(repairParts.ticketId, t.id));
  const [payment] = await db.select().from(repairPayments).where(eq(repairPayments.ticketId, t.id)).limit(1);

  const status = t.status as RepairStatus;
  const isMine = t.technicianId === myId;
  const bench = manage || (update && isMine);
  const closed = status === "COLLECTED" || status === "CANCELLED";
  const partsCost = parts.reduce((a, x) => a + (x.p.unitCost ?? 0) * x.p.quantity, 0);

  const technicians = manage && !closed
    ? (await db.select().from(admins).where(eq(admins.active, true))).filter((a) => hasPermission(a.staffRole, "repairs.update"))
    : [];
  const stockParts = bench && status === "IN_REPAIR"
    ? await db.select({ id: products.id, title: products.title, stock: products.stock }).from(products).where(and(eq(products.status, "active"))).orderBy(asc(products.title)).limit(300)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/business-os/repairs" className="text-sm text-blue hover:underline">← Repairs</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-navy">{t.ticketNumber}</h1>
          <span className="rounded-full bg-light px-2 py-0.5 text-xs font-medium text-navy">{status.replace("_", " ")}</span>
          <Link href={`/admin/business-os/repairs/${t.ticketNumber}/slip`} className="text-sm text-blue hover:underline" target="_blank">Print job slip</Link>
        </div>
        <p className="text-sm text-slate">
          {[t.brand, t.model].filter(Boolean).join(" ") || t.deviceType}
          {t.imei ? ` · ${t.imei}` : ""} · {cust?.fullName ?? "Customer"} {cust?.phone ?? ""}
          {manage && cust && <> · <Link className="text-blue hover:underline" href={`/admin/business-os/customers/${cust.id}`}>profile</Link></>}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-white p-5 text-sm">
        <p className="font-medium text-slate">Problem reported</p>
        <p className="mt-1 text-navy">{t.issue}</p>
        {t.intakeNotes && <><p className="mt-3 font-medium text-slate">On arrival</p><p className="mt-1 text-navy">{t.intakeNotes}</p></>}
        <p className="mt-3 text-slate">Technician: <span className="text-navy">{tech ? tech.name ?? tech.email : "Not assigned"}</span></p>
      </div>

      {manage && !closed && (
        <ActionForm action={assignRepairTechnician} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white p-5">
          <input type="hidden" name="ticketId" value={t.id} />
          <select name="technicianId" className={input} defaultValue={t.technicianId ?? ""} required>
            <option value="" disabled>Choose technician</option>
            {technicians.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.email} ({a.staffRole})</option>)}
          </select>
          <button className={btn}>{t.technicianId ? "Reassign" : "Assign"}</button>
        </ActionForm>
      )}

      {bench && !closed && (
        <ActionForm action={saveRepairDiagnosis} className="rounded-xl border border-border bg-white p-5">
          <input type="hidden" name="ticketId" value={t.id} />
          <p className="text-sm font-medium text-slate">Diagnosis / work done</p>
          <textarea name="diagnosis" required defaultValue={t.diagnosis ?? ""} maxLength={4000} className={`${input} mt-2 w-full`} rows={3} />
          <button className={`${btn} mt-2`}>Save</button>
        </ActionForm>
      )}
      {!bench && t.diagnosis && (
        <div className="rounded-xl border border-border bg-white p-5 text-sm"><p className="font-medium text-slate">Diagnosis</p><p className="mt-1 text-navy">{t.diagnosis}</p></div>
      )}

      {/* Quote: managers only. External technician cost is staff-only margin data. */}
      {manage && status === "DIAGNOSING" && (
        <ActionForm action={quoteRepair} className="rounded-xl border border-border bg-white p-5">
          <input type="hidden" name="ticketId" value={t.id} />
          <p className="text-sm font-medium text-slate">Give a quote</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input name="amount" type="number" min={0} step={1} required placeholder="Quote to customer (UGX)" className={input} />
            <input name="externalTechnician" placeholder="External technician (if any)" className={input} />
            <input name="externalCost" type="number" min={0} step={1} placeholder="Their charge (UGX, internal)" className={input} />
          </div>
          <button className={`${btn} mt-3`}>Save quote</button>
          <p className="mt-2 text-xs text-slate">The external charge is never shown to the customer or printed on the slip.</p>
        </ActionForm>
      )}
      {(manage || counter) && t.quoteAmount != null && (
        <div className="rounded-xl border border-border bg-white p-5 text-sm">
          <p className="font-medium text-slate">Quote</p>
          <p className="mt-1 text-lg font-semibold text-navy">{fmt(t.quoteAmount)} UGX</p>
          {t.approvalNote && <p className="mt-1 text-slate">Approved by {t.approvedBy ? "staff" : ""} on {t.approvedAt ? stamp(t.approvedAt) : "—"}: {t.approvalNote}</p>}
          {manage && (
            <p className="mt-2 text-xs text-slate">
              Internal: parts {fmt(partsCost)} · external {fmt(t.externalCost)}{t.externalTechnician ? ` (${t.externalTechnician})` : ""} · margin {fmt(repairMargin(t.quoteAmount, partsCost, t.externalCost))} UGX
            </p>
          )}
        </div>
      )}
      {manage && status === "QUOTED" && (
        <ActionForm action={answerRepairQuote} className="rounded-xl border border-border bg-white p-5">
          <input type="hidden" name="ticketId" value={t.id} />
          <p className="text-sm font-medium text-slate">Customer&apos;s answer</p>
          <input name="note" required placeholder="How did they answer? (e.g. phoned, agreed)" className={`${input} mt-2 w-full`} />
          <div className="mt-3 flex gap-2">
            <button name="answer" value="approve" className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Customer approved</button>
            <button name="answer" value="decline" className={btn}>Customer declined</button>
          </div>
        </ActionForm>
      )}

      {bench && !closed && (
        <div className="flex flex-wrap gap-3 rounded-xl border border-border bg-white p-5">
          {status === "RECEIVED" && <Move id={t.id} to="DIAGNOSING" label="Start diagnosing" />}
          {status === "APPROVED" && <Move id={t.id} to="IN_REPAIR" label="Start repair" />}
          {status === "IN_REPAIR" && <Move id={t.id} to="QUALITY_CHECK" label="Send to quality check" />}
          {manage && status === "QUALITY_CHECK" && <Move id={t.id} to="READY" label="Quality check passed — ready" />}
          {manage && status === "QUALITY_CHECK" && <Move id={t.id} to="IN_REPAIR" label="Failed — back to bench" askNote="What failed?" />}
          {manage && ["RECEIVED", "DIAGNOSING", "QUOTED", "APPROVED", "IN_REPAIR"].includes(status) && (
            <Move id={t.id} to="CANCELLED" label="Cancel ticket" askNote="Reason for cancelling" />
          )}
        </div>
      )}

      {stockParts.length > 0 && (
        <ActionForm action={fitRepairPart} className="rounded-xl border border-border bg-white p-5">
          <input type="hidden" name="ticketId" value={t.id} />
          <p className="text-sm font-medium text-slate">Fit a part from stock</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select name="productId" required className={input} defaultValue="">
              <option value="" disabled>Choose part</option>
              {stockParts.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.stock} in stock)</option>)}
            </select>
            <input name="quantity" type="number" min={1} step={1} defaultValue={1} className={`${input} w-24`} />
            <button className={btn}>Fit part</button>
          </div>
        </ActionForm>
      )}
      {parts.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5 text-sm">
          <p className="font-medium text-slate">Parts used</p>
          <ul className="mt-2 divide-y divide-border">
            {parts.map((x) => <li key={x.p.id} className="py-1.5 text-navy">{x.p.quantity} × {x.title}{manage && x.p.unitCost != null ? <span className="text-slate"> — cost {fmt(x.p.unitCost)} each</span> : null}</li>)}
          </ul>
        </div>
      )}

      {counter && (status === "READY" || status === "DECLINED") && (
        <ActionForm action={collectRepair} className="rounded-xl border border-border bg-white p-5">
          <input type="hidden" name="ticketId" value={t.id} />
          <p className="text-sm font-medium text-slate">Hand over to customer</p>
          <p className="mt-1 text-sm text-navy">{status === "DECLINED" ? "Quote was declined — nothing to pay." : `Take ${fmt(t.quoteAmount ?? 0)} UGX cash into your open cash session.`}</p>
          <button className="mt-3 rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Collect &amp; hand over</button>
        </ActionForm>
      )}
      {payment && <p className="text-sm text-slate">Paid {fmt(payment.amount)} UGX cash on {stamp(payment.createdAt)}.</p>}

      <div className="rounded-xl border border-border bg-white p-5">
        <p className="text-sm font-medium text-slate">History</p>
        <ul className="mt-3 divide-y divide-border text-sm">
          {events.map(({ e, by, byEmail }) => (
            <li key={e.id} className="flex flex-wrap gap-x-3 py-2">
              <span className="w-40 shrink-0 text-xs text-slate">{stamp(e.createdAt)}</span>
              <span className="w-28 shrink-0 text-xs font-medium text-slate">{e.toStatus.replace("_", " ")}</span>
              <span className="text-navy">{e.note ?? ""} <span className="text-xs text-slate">— {by ?? byEmail}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
