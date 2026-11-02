import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sopDocuments, sopVersions } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/staff-session";
import { hasPermission } from "@/lib/rbac";
import { loadSopRegister } from "@/lib/admin-actions";
import { pendingForEmployee } from "@/lib/sop-service";
import { ActionForm } from "@/components/ActionForm";
import { kampalaDateKey } from "@/lib/reports";
import { parseRoles, reviewState } from "@/lib/sops";

export default async function SopsPage() {
  const me = await getCurrentStaffSession();
  if (!me || !hasPermission(me.staffRole, "sops.read")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">SOPs</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to procedures.</p>
      </div>
    );
  }
  const manage = hasPermission(me.staffRole, "sops.manage");
  const owner = hasPermission(me.staffRole, "settings.manage");
  const today = kampalaDateKey(new Date());

  const docs = await db.select().from(sopDocuments).orderBy(asc(sopDocuments.sopId));
  const versions = await db.select().from(sopVersions);
  const pending = new Set((await pendingForEmployee(Number(me.adminId), me.staffRole)).map((p) => p.sopId));

  const rows = docs.map((d) => {
    const vs = versions.filter((v) => v.documentId === d.id);
    const approved = vs.find((v) => v.status === "APPROVED");
    const draft = vs.find((v) => v.status === "DRAFT");
    return { d, approved, draft };
  }).filter((r) => manage || r.approved); // staff only see approved procedures

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Standard operating procedures</h1>
        <p className="mt-1 text-sm text-slate">Only approved versions are active. Read each one that applies to you and acknowledge it.</p>
      </div>

      {pending.size > 0 && (
        <p role="note" className="rounded-lg border border-border bg-light p-3 text-sm text-navy">
          You have {pending.size} procedure{pending.size === 1 ? "" : "s"} to acknowledge.
        </p>
      )}

      {docs.length === 0 && (
        <div className="rounded-xl border border-border bg-white p-6 text-sm text-slate">
          <p>No SOPs have been loaded yet.</p>
          {owner ? (
            <ActionForm action={loadSopRegister} className="mt-3">
              <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Load the 20-SOP register</button>
              <p className="mt-2 text-xs">From the Document Pack. Procedures it wrote out arrive as drafts for you to approve; the rest are listed with no text.</p>
            </ActionForm>
          ) : <p className="mt-1">Ask the owner to load the register.</p>}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-slate">
            <tr>{["ID", "Title", "Owner", "Active version", "Review", "For you"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map(({ d, approved, draft }) => {
              const rs = reviewState(approved?.reviewDate, today);
              const applies = parseRoles(d.applicableRoles).includes(me.staffRole ?? "");
              return (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-slate">{d.sopId}</td>
                  <td className="px-4 py-3"><Link className="text-blue hover:underline" href={`/admin/business-os/sops/${d.sopId}`}>{d.title}</Link></td>
                  <td className="px-4 py-3 text-slate">{d.ownerRole}</td>
                  <td className="px-4 py-3 text-slate">
                    {approved ? `v${approved.version}` : draft ? "Draft only" : "Not written yet"}
                    {manage && approved && draft ? " · new draft" : ""}
                  </td>
                  <td className="px-4 py-3 text-slate">{approved?.reviewDate ?? "—"}{rs === "OVERDUE" ? " · overdue" : rs === "DUE_SOON" ? " · due soon" : ""}</td>
                  <td className="px-4 py-3 text-slate">{!applies ? "—" : pending.has(d.sopId) ? <b className="text-navy">Acknowledge</b> : approved ? "Done" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
