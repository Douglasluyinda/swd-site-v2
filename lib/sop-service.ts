import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, sopAcknowledgements, sopDocuments, sopVersions } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings-service";
import { SOP_SEED } from "@/lib/sop-seed";
import {
  REVIEW_MONTHS_DEFAULT, addMonths, mustAcknowledge, parseRoles, pendingAcknowledgements, validateApproval,
  validateDraft, validateRoles,
} from "@/lib/sops";
import { kampalaDateKey } from "@/lib/reports";

// Inside transactions use `tx`, never the global `db` (single-connection pool).
type Tx = typeof db;
const today = () => kampalaDateKey(new Date());

async function docBySopId(tx: Tx, sopId: string) {
  const [d] = await tx.select().from(sopDocuments).where(eq(sopDocuments.sopId, sopId)).for("update");
  if (!d) throw new Error("SOP not found.");
  return d;
}

// Loads the register from the Document Pack. Safe to run twice: existing
// documents and versions are never touched.
export async function seedRegister(by: number) {
  return db.transaction(async (tx) => {
    let docs = 0, drafts = 0;
    for (const s of SOP_SEED) {
      const inserted = await tx.insert(sopDocuments).values({
        sopId: s.sopId, title: s.title, ownerRole: s.ownerRole, applicableRoles: s.applicable.join(","),
      }).onConflictDoNothing().returning({ id: sopDocuments.id });
      if (inserted.length) docs++;
      if (!s.draft) continue;
      const [doc] = await tx.select().from(sopDocuments).where(eq(sopDocuments.sopId, s.sopId));
      const existing = await tx.select({ id: sopVersions.id }).from(sopVersions).where(eq(sopVersions.documentId, doc.id)).limit(1);
      if (existing.length) continue;
      await tx.insert(sopVersions).values({
        documentId: doc.id, version: 1, status: "DRAFT", purpose: s.draft.purpose, body: s.draft.steps.join("\n"),
        exceptions: s.draft.exceptions ?? null, records: s.draft.records ?? null,
        changeNote: "Loaded from the SWD Business OS Document Pack — awaiting owner approval.", authoredBy: by,
      });
      drafts++;
    }
    return { docs, drafts };
  });
}

export async function startDraft(input: { sopId: string; by: number }) {
  return db.transaction(async (tx) => {
    const d = await docBySopId(tx as unknown as Tx, input.sopId);
    const versions = await tx.select().from(sopVersions).where(eq(sopVersions.documentId, d.id)).orderBy(desc(sopVersions.version));
    if (versions.some((v) => v.status === "DRAFT")) throw new Error("There is already a draft for this SOP.");
    const base = versions[0];
    await tx.insert(sopVersions).values({
      documentId: d.id, version: (base?.version ?? 0) + 1, status: "DRAFT", authoredBy: input.by,
      purpose: base?.purpose ?? null, scope: base?.scope ?? null, body: base?.body ?? "", exceptions: base?.exceptions ?? null,
      escalation: base?.escalation ?? null, records: base?.records ?? null, reviewDate: null,
    });
  });
}

export async function saveDraft(input: {
  sopId: string; by: number; purpose: string; scope?: string | null; body: string; exceptions?: string | null;
  escalation?: string | null; records?: string | null; reviewDate?: string | null; changeNote?: string | null; roles?: string[];
}) {
  const err = validateDraft(input);
  if (err) throw new Error(err);
  if (input.roles) { const re = validateRoles(input.roles); if (re) throw new Error(re); }
  return db.transaction(async (tx) => {
    const d = await docBySopId(tx as unknown as Tx, input.sopId);
    const [draft] = await tx.select().from(sopVersions).where(and(eq(sopVersions.documentId, d.id), eq(sopVersions.status, "DRAFT"))).for("update");
    if (!draft) throw new Error("There is no draft to save. Start a new version first.");
    await tx.update(sopVersions).set({
      purpose: input.purpose.trim(), scope: input.scope?.trim() || null, body: input.body.trim(),
      exceptions: input.exceptions?.trim() || null, escalation: input.escalation?.trim() || null, records: input.records?.trim() || null,
      reviewDate: input.reviewDate || null, changeNote: input.changeNote?.trim() || draft.changeNote, authoredBy: input.by,
    }).where(eq(sopVersions.id, draft.id));
    if (input.roles) await tx.update(sopDocuments).set({ applicableRoles: input.roles.join(",") }).where(eq(sopDocuments.id, d.id));
  });
}

export async function discardDraft(input: { sopId: string }) {
  return db.transaction(async (tx) => {
    const d = await docBySopId(tx as unknown as Tx, input.sopId);
    const [draft] = await tx.select().from(sopVersions).where(and(eq(sopVersions.documentId, d.id), eq(sopVersions.status, "DRAFT"))).for("update");
    if (!draft) throw new Error("There is no draft.");
    await tx.delete(sopVersions).where(eq(sopVersions.id, draft.id));
  });
}

export async function approveDraft(input: { sopId: string; actor: { id: number; role: string } }) {
  return db.transaction(async (tx) => {
    const d = await docBySopId(tx as unknown as Tx, input.sopId);
    const [draft] = await tx.select().from(sopVersions).where(and(eq(sopVersions.documentId, d.id), eq(sopVersions.status, "DRAFT"))).for("update");
    if (!draft) throw new Error("There is no draft to approve.");
    const err = validateApproval({
      status: draft.status, actorRole: input.actor.role, actorId: input.actor.id, authorId: draft.authoredBy,
      reviewDate: draft.reviewDate, today: today(),
    });
    if (err) throw new Error(err);
    // Supersede first: the partial unique index allows one APPROVED per SOP.
    await tx.update(sopVersions).set({ status: "SUPERSEDED" }).where(and(eq(sopVersions.documentId, d.id), eq(sopVersions.status, "APPROVED")));
    await tx.update(sopVersions).set({ status: "APPROVED", approvedBy: input.actor.id, approvedAt: new Date(), effectiveDate: today() }).where(eq(sopVersions.id, draft.id));
    return { version: draft.version };
  });
}

export async function acknowledge(input: { sopId: string; employeeId: number; role: string }) {
  return db.transaction(async (tx) => {
    const d = await docBySopId(tx as unknown as Tx, input.sopId);
    const [v] = await tx.select().from(sopVersions).where(and(eq(sopVersions.documentId, d.id), eq(sopVersions.status, "APPROVED")));
    if (!v) throw new Error("There is no approved version to acknowledge yet.");
    if (!mustAcknowledge(input.role, parseRoles(d.applicableRoles))) throw new Error("This SOP does not apply to your role.");
    await tx.insert(sopAcknowledgements).values({ versionId: v.id, employeeId: input.employeeId }).onConflictDoNothing();
    return { version: v.version };
  });
}

export async function ackStatus(sopId: string) {
  const [d] = await db.select().from(sopDocuments).where(eq(sopDocuments.sopId, sopId));
  if (!d) return null;
  const [v] = await db.select().from(sopVersions).where(and(eq(sopVersions.documentId, d.id), eq(sopVersions.status, "APPROVED")));
  const staff = (await db.select({ id: admins.id, name: admins.name, email: admins.email, role: admins.staffRole, active: admins.active }).from(admins));
  if (!v) return { doc: d, version: null, pending: [], done: [] };
  const acks = await db.select().from(sopAcknowledgements).where(eq(sopAcknowledgements.versionId, v.id));
  const doneIds = new Set(acks.map((a) => a.employeeId));
  const applicable = parseRoles(d.applicableRoles);
  const pendingIds = new Set(pendingAcknowledgements(staff.map((s) => ({ id: s.id, role: s.role, active: s.active })), applicable, doneIds));
  const label = (s: (typeof staff)[number]) => ({ id: s.id, name: s.name ?? s.email, role: s.role });
  return {
    doc: d, version: v,
    pending: staff.filter((s) => pendingIds.has(s.id)).map(label),
    done: staff.filter((s) => doneIds.has(s.id)).map((s) => ({ ...label(s), at: acks.find((a) => a.employeeId === s.id)!.createdAt })),
  };
}

// SOPs this employee must acknowledge and hasn't yet (current approved versions only).
export async function pendingForEmployee(employeeId: number, role: string | null | undefined) {
  if (!role) return [];
  const rows = await db
    .select({ sopId: sopDocuments.sopId, title: sopDocuments.title, applicable: sopDocuments.applicableRoles, versionId: sopVersions.id, version: sopVersions.version })
    .from(sopDocuments).innerJoin(sopVersions, and(eq(sopVersions.documentId, sopDocuments.id), eq(sopVersions.status, "APPROVED")))
    .orderBy(asc(sopDocuments.sopId));
  const mine = rows.filter((r) => mustAcknowledge(role, parseRoles(r.applicable)));
  if (!mine.length) return [];
  const acks = await db.select({ versionId: sopAcknowledgements.versionId }).from(sopAcknowledgements)
    .where(and(eq(sopAcknowledgements.employeeId, employeeId), inArray(sopAcknowledgements.versionId, mine.map((m) => m.versionId))));
  const done = new Set(acks.map((a) => a.versionId));
  return mine.filter((m) => !done.has(m.versionId));
}

export const DEFAULT_REVIEW_MONTHS = REVIEW_MONTHS_DEFAULT;
export const defaultReviewDate = async () => addMonths(today(), (await getSettings())["sop.review_months"]);
