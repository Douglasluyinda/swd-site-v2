// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, sopAcknowledgements, sopDocuments, sopVersions } from "@/lib/db/schema";
import { SOP_SEED } from "@/lib/sop-seed";
import { acknowledge, ackStatus, approveDraft, discardDraft, pendingForEmployee, saveDraft, seedRegister, startDraft } from "@/lib/sop-service";

const tag = () => `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const FUTURE = "2099-01-01";
async function world() {
  const t = tag();
  const mk = async (role: string, n: string) => (await db.insert(admins).values({ email: `sop-${n}-${t}@test.local`, passwordHash: "x", staffRole: role }).returning())[0];
  const owner = await mk("OWNER", "o"), mgr = await mk("MANAGER", "m"), cash = await mk("CASHIER", "c"), tech = await mk("TECHNICIAN", "t");
  const sopId = `T-${t}`;
  await db.insert(sopDocuments).values({ sopId, title: "Test SOP", ownerRole: "Manager", applicableRoles: "CASHIER,MANAGER" });
  return { owner, mgr, cash, tech, sopId };
}
const content = (sopId: string, by: number, body = "Step one\nStep two") => ({ sopId, by, purpose: "Because", body, reviewDate: FUTURE });

describe("sops (integration)", () => {
  it("seeds the register once, with drafts only where the pack has text", { timeout: 20000 }, async () => {
    const w = await world();
    await seedRegister(w.owner.id);
    const again = await seedRegister(w.owner.id);
    expect(again).toEqual({ docs: 0, drafts: 0 });
    const docs = await db.select().from(sopDocuments);
    expect(SOP_SEED.every((s) => docs.some((d) => d.sopId === s.sopId))).toBe(true);
    const [d1] = await db.select().from(sopDocuments).where(eq(sopDocuments.sopId, "SOP-001"));
    const [v] = await db.select().from(sopVersions).where(eq(sopVersions.documentId, d1.id));
    expect(v.status).toBe("DRAFT"); // never auto-approved
    const [d3] = await db.select().from(sopDocuments).where(eq(sopDocuments.sopId, "SOP-003"));
    expect(await db.select().from(sopVersions).where(eq(sopVersions.documentId, d3.id))).toHaveLength(0);
  });

  it("draft → owner approval → acknowledgement; a new version resets acknowledgements", async () => {
    const w = await world();
    await startDraft({ sopId: w.sopId, by: w.mgr.id });
    await expect(startDraft({ sopId: w.sopId, by: w.mgr.id })).rejects.toThrow(/already a draft/);
    await expect(approveDraft({ sopId: w.sopId, actor: { id: w.owner.id, role: "OWNER" } })).rejects.toThrow(/review date|future/);
    await expect(saveDraft({ ...content(w.sopId, w.mgr.id), body: "  " })).rejects.toThrow(/step/);
    await saveDraft(content(w.sopId, w.mgr.id));
    await expect(approveDraft({ sopId: w.sopId, actor: { id: w.mgr.id, role: "MANAGER" } })).rejects.toThrow(/owner/);
    await expect(acknowledge({ sopId: w.sopId, employeeId: w.cash.id, role: "CASHIER" })).rejects.toThrow(/no approved version/);

    await approveDraft({ sopId: w.sopId, actor: { id: w.owner.id, role: "OWNER" } });
    await expect(approveDraft({ sopId: w.sopId, actor: { id: w.owner.id, role: "OWNER" } })).rejects.toThrow(/no draft/);

    expect((await pendingForEmployee(w.cash.id, "CASHIER")).some((p) => p.sopId === w.sopId)).toBe(true);
    expect((await pendingForEmployee(w.tech.id, "TECHNICIAN")).some((p) => p.sopId === w.sopId)).toBe(false);
    await expect(acknowledge({ sopId: w.sopId, employeeId: w.tech.id, role: "TECHNICIAN" })).rejects.toThrow(/does not apply/);
    await acknowledge({ sopId: w.sopId, employeeId: w.cash.id, role: "CASHIER" });
    await acknowledge({ sopId: w.sopId, employeeId: w.cash.id, role: "CASHIER" }); // idempotent
    let s = (await ackStatus(w.sopId))!;
    expect(s.done.map((x) => x.id)).toEqual([w.cash.id]);
    expect(s.pending.map((x) => x.id)).toContain(w.mgr.id);

    // version 2 supersedes version 1 and everyone must acknowledge again
    await startDraft({ sopId: w.sopId, by: w.mgr.id });
    await saveDraft({ ...content(w.sopId, w.mgr.id, "New step"), changeNote: "reworded" });
    await approveDraft({ sopId: w.sopId, actor: { id: w.owner.id, role: "OWNER" } });
    const versions = await db.select().from(sopVersions).innerJoin(sopDocuments, eq(sopDocuments.id, sopVersions.documentId)).where(eq(sopDocuments.sopId, w.sopId));
    expect(versions.map((v) => `${v.sop_versions.version}:${v.sop_versions.status}`).sort()).toEqual(["1:SUPERSEDED", "2:APPROVED"]);
    s = (await ackStatus(w.sopId))!;
    expect(s.version!.version).toBe(2);
    expect(s.done).toHaveLength(0);
    expect((await pendingForEmployee(w.cash.id, "CASHIER")).some((p) => p.sopId === w.sopId)).toBe(true);
  });

  it("two simultaneous approvals approve once; a draft can be discarded", async () => {
    const w = await world();
    await startDraft({ sopId: w.sopId, by: w.mgr.id });
    await saveDraft(content(w.sopId, w.mgr.id));
    const r = await Promise.allSettled([1, 2].map(() => approveDraft({ sopId: w.sopId, actor: { id: w.owner.id, role: "OWNER" } })));
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    await startDraft({ sopId: w.sopId, by: w.mgr.id });
    await discardDraft({ sopId: w.sopId });
    await expect(discardDraft({ sopId: w.sopId })).rejects.toThrow(/no draft/);
  });

  it("acknowledgements cannot be edited or deleted", async () => {
    const w = await world();
    await startDraft({ sopId: w.sopId, by: w.mgr.id });
    await saveDraft(content(w.sopId, w.mgr.id));
    await approveDraft({ sopId: w.sopId, actor: { id: w.owner.id, role: "OWNER" } });
    await acknowledge({ sopId: w.sopId, employeeId: w.cash.id, role: "CASHIER" });
    await expect(db.delete(sopAcknowledgements).where(eq(sopAcknowledgements.employeeId, w.cash.id))).rejects.toThrow();
  });
});
