import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { sopAcknowledgements, sopDocuments, sopVersions } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { acknowledgeSopAction, approveSopAction, beginSopDraft, discardSopDraftAction, saveSopDraftAction } from "@/lib/admin-actions";
import { ackStatus, defaultReviewDate } from "@/lib/sop-service";
import { ActionForm } from "@/components/ActionForm";
import { parseRoles, parseSteps, SOP_ROLES } from "@/lib/sops";

const input = "w-full rounded-lg border border-border-strong px-3 py-2 text-sm";
const btn = "rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border";
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function SopPage({ params }: { params: Promise<{ sopId: string }> }) {
  const { sopId } = await params;
  const me = await getCurrentStaffSession();
  if (!me || !hasPermission(me.staffRole, "sops.read")) notFound();
  const manage = hasPermission(me.staffRole, "sops.manage");
  const owner = hasPermission(me.staffRole, "settings.manage");

  const [d] = await db.select().from(sopDocuments).where(eq(sopDocuments.sopId, sopId)).limit(1);
  if (!d) notFound();
  const versions = await db.select().from(sopVersions).where(eq(sopVersions.documentId, d.id)).orderBy(desc(sopVersions.version));
  const approved = versions.find((v) => v.status === "APPROVED");
  const draft = manage ? versions.find((v) => v.status === "DRAFT") : undefined;
  if (!approved && !manage) notFound(); // staff never see unapproved text

  const applicable = parseRoles(d.applicableRoles);
  const applies = applicable.includes(me.staffRole ?? "");
  const [mine] = approved
    ? await db.select().from(sopAcknowledgements).where(and(eq(sopAcknowledgements.versionId, approved.id), eq(sopAcknowledgements.employeeId, Number(me.adminId)))).limit(1)
    : [];
  const status = manage ? await ackStatus(sopId) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/business-os/sops" className="text-sm text-blue hover:underline">← SOPs</Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">{d.sopId} — {d.title}</h1>
        <p className="text-sm text-slate">Owner: {d.ownerRole} · Applies to: {applicable.join(", ")}</p>
      </div>

      {approved ? (
        <div className="rounded-xl border border-border bg-white p-5 text-sm">
          <p className="text-xs text-slate">Version {approved.version} · effective {approved.effectiveDate} · review by {approved.reviewDate}</p>
          {approved.purpose && <><p className="mt-3 font-medium text-slate">Purpose</p><p className="text-navy">{approved.purpose}</p></>}
          {approved.scope && <><p className="mt-3 font-medium text-slate">Scope</p><p className="text-navy">{approved.scope}</p></>}
          <p className="mt-3 font-medium text-slate">Procedure</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-navy">{parseSteps(approved.body).map((s, i) => <li key={i}>{s}</li>)}</ol>
          {approved.exceptions && <><p className="mt-3 font-medium text-slate">Exceptions</p><p className="text-navy">{approved.exceptions}</p></>}
          {approved.escalation && <><p className="mt-3 font-medium text-slate">Escalation</p><p className="text-navy">{approved.escalation}</p></>}
          {approved.records && <><p className="mt-3 font-medium text-slate">Records</p><p className="text-navy">{approved.records}</p></>}

          {applies && (mine ? (
            <p className="mt-4 text-slate">You acknowledged version {approved.version} on {day(mine.createdAt)}.</p>
          ) : (
            <ActionForm action={acknowledgeSopAction} className="mt-4">
              <input type="hidden" name="sopId" value={d.sopId} />
              <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">I have read and understood version {approved.version}</button>
            </ActionForm>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-white p-5 text-sm text-slate">No approved version yet.</p>
      )}

      {manage && !draft && (
        <ActionForm action={beginSopDraft} className="rounded-xl border border-border bg-white p-5">
          <input type="hidden" name="sopId" value={d.sopId} />
          <button className={btn}>{approved ? "Start a new version" : "Write the first version"}</button>
          {approved && <p className="mt-2 text-xs text-slate">Starts from the current text. The active version stays in force until the owner approves the new one.</p>}
        </ActionForm>
      )}

      {draft && (
        <div className="space-y-3 rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Draft version {draft.version} (not active)</p>
          <ActionForm action={saveSopDraftAction} className="space-y-3">
            <input type="hidden" name="sopId" value={d.sopId} />
            <label className="block text-sm text-slate">Purpose<textarea name="purpose" required defaultValue={draft.purpose ?? ""} rows={2} className={input} /></label>
            <label className="block text-sm text-slate">Scope<textarea name="scope" defaultValue={draft.scope ?? ""} rows={2} className={input} /></label>
            <label className="block text-sm text-slate">Procedure — one step per line<textarea name="body" required defaultValue={draft.body} rows={12} className={input} /></label>
            <label className="block text-sm text-slate">Exceptions<textarea name="exceptions" defaultValue={draft.exceptions ?? ""} rows={2} className={input} /></label>
            <label className="block text-sm text-slate">Escalation<textarea name="escalation" defaultValue={draft.escalation ?? ""} rows={2} className={input} /></label>
            <label className="block text-sm text-slate">Records kept<textarea name="records" defaultValue={draft.records ?? ""} rows={2} className={input} /></label>
            <label className="block text-sm text-slate">What changed<input name="changeNote" defaultValue={draft.changeNote ?? ""} className={input} /></label>
            <label className="block text-sm text-slate">Review by (YYYY-MM-DD)<input name="reviewDate" defaultValue={draft.reviewDate ?? defaultReviewDate()} className={input} /></label>
            <fieldset className="text-sm text-slate">
              <legend>Staff who must acknowledge</legend>
              <div className="mt-1 flex flex-wrap gap-4">
                {SOP_ROLES.map((r) => <label key={r} className="flex items-center gap-1"><input type="checkbox" name="roles" value={r} defaultChecked={applicable.includes(r)} />{r}</label>)}
              </div>
            </fieldset>
            <button className={btn}>Save draft</button>
          </ActionForm>
          <div className="flex flex-wrap gap-3">
            {owner && (
              <ActionForm action={approveSopAction}>
                <input type="hidden" name="sopId" value={d.sopId} />
                <button className="rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white">Approve and make active</button>
              </ActionForm>
            )}
            <ActionForm action={discardSopDraftAction}>
              <input type="hidden" name="sopId" value={d.sopId} />
              <button className={btn}>Discard draft</button>
            </ActionForm>
          </div>
          <p className="text-xs text-slate">Save before approving. Approval replaces the active version and everyone must acknowledge again. {owner ? "" : "Only the owner can approve."}</p>
        </div>
      )}

      {status && status.version && (
        <div className="rounded-xl border border-border bg-white p-5 text-sm">
          <p className="font-medium text-slate">Acknowledgements — version {status.version.version}</p>
          <p className="mt-2 text-navy">Still to acknowledge: {status.pending.length ? status.pending.map((p) => `${p.name} (${p.role})`).join(", ") : "nobody"}</p>
          <p className="mt-1 text-slate">Done: {status.done.length ? status.done.map((p) => `${p.name} ${day(p.at)}`).join(", ") : "nobody yet"}</p>
        </div>
      )}

      {manage && versions.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-5 text-sm">
          <p className="font-medium text-slate">Version history</p>
          <ul className="mt-2 divide-y divide-border">
            {versions.map((v) => (
              <li key={v.id} className="py-2 text-slate">v{v.version} · {v.status}{v.effectiveDate ? ` · effective ${v.effectiveDate}` : ""}{v.changeNote ? ` — ${v.changeNote}` : ""}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
