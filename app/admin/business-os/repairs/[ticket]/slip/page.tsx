import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { customers, repairTickets } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { PrintButton } from "../../../pos/receipt/[receiptNumber]/PrintButton";

// Customer-facing job slip. Deliberately selects NO internal columns:
// no external technician, no external cost, no parts cost, no margin.
export default async function SlipPage({ params }: { params: Promise<{ ticket: string }> }) {
  const { ticket } = await params;
  const me = await getCurrentStaffSession();
  if (!me || !(hasPermission(me.staffRole, "repairs.counter") || hasPermission(me.staffRole, "repairs.manage"))) notFound();
  const [t] = await db
    .select({
      ticketNumber: repairTickets.ticketNumber, deviceType: repairTickets.deviceType, brand: repairTickets.brand,
      model: repairTickets.model, imei: repairTickets.imei, issue: repairTickets.issue, intakeNotes: repairTickets.intakeNotes,
      status: repairTickets.status, quoteAmount: repairTickets.quoteAmount, createdAt: repairTickets.createdAt,
      customerName: customers.fullName, customerPhone: customers.phone,
    })
    .from(repairTickets).innerJoin(customers, eq(customers.id, repairTickets.customerId))
    .where(eq(repairTickets.ticketNumber, ticket)).limit(1);
  if (!t) notFound();

  return (
    <div className="mx-auto max-w-sm rounded-xl border border-border bg-white p-6 text-sm print:border-0">
      <p className="text-center text-base font-semibold text-navy">SWD — Smart Devices &amp; Digital Services</p>
      <p className="text-center text-slate">Repair job slip</p>
      <p className="mt-4 text-center text-lg font-semibold text-navy">{t.ticketNumber}</p>
      <p className="text-center text-xs text-slate">{t.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
      <dl className="mt-4 space-y-1">
        <div className="flex justify-between"><dt className="text-slate">Customer</dt><dd className="text-navy">{t.customerName}</dd></div>
        <div className="flex justify-between"><dt className="text-slate">Phone</dt><dd className="text-navy">{t.customerPhone}</dd></div>
        <div className="flex justify-between"><dt className="text-slate">Device</dt><dd className="text-navy">{[t.brand, t.model].filter(Boolean).join(" ") || t.deviceType}</dd></div>
        {t.imei && <div className="flex justify-between"><dt className="text-slate">IMEI / serial</dt><dd className="text-navy">{t.imei}</dd></div>}
        <div className="flex justify-between"><dt className="text-slate">Status</dt><dd className="text-navy">{t.status.replace("_", " ")}</dd></div>
        {t.quoteAmount != null && <div className="flex justify-between"><dt className="text-slate">Quote</dt><dd className="text-navy">{t.quoteAmount.toLocaleString()} UGX</dd></div>}
      </dl>
      <p className="mt-4 text-slate">Problem reported</p>
      <p className="text-navy">{t.issue}</p>
      {t.intakeNotes && <><p className="mt-3 text-slate">On arrival</p><p className="text-navy">{t.intakeNotes}</p></>}
      <p className="mt-4 text-xs text-slate">Please bring this slip when collecting your device. Repairs begin only after you approve the quote.</p>
      <div className="mt-4 print:hidden"><PrintButton /></div>
    </div>
  );
}
