import { describe, expect, it } from "vitest";
import { addMonths, mustAcknowledge, parseSteps, pendingAcknowledgements, reviewState, validateApproval, validateDraft, validateRoles } from "@/lib/sops";
import { SOP_SEED } from "@/lib/sop-seed";

describe("sop rules", () => {
  it("drafts need steps and a purpose", () => {
    expect(validateDraft({ body: " \n ", purpose: "x" })).toMatch(/step/);
    expect(validateDraft({ body: "Do it", purpose: "" })).toMatch(/purpose/);
    expect(validateDraft({ body: "Do it", purpose: "p", reviewDate: "next year" })).toMatch(/YYYY/);
    expect(validateDraft({ body: "Do it\n\nThen this", purpose: "p" })).toBeNull();
    expect(parseSteps("a\r\n\n b ")).toEqual(["a", "b"]);
  });
  it("only the owner approves, a draft, with a future review date", () => {
    const ok = { status: "DRAFT", actorRole: "OWNER", actorId: 1, authorId: 1, reviewDate: "2027-11-01", today: "2026-11-01" };
    expect(validateApproval(ok)).toBeNull(); // owner may approve their own draft
    expect(validateApproval({ ...ok, actorRole: "MANAGER" })).toMatch(/owner/);
    expect(validateApproval({ ...ok, status: "APPROVED" })).toMatch(/draft/);
    expect(validateApproval({ ...ok, reviewDate: null })).toMatch(/review date/);
    expect(validateApproval({ ...ok, reviewDate: "2026-11-01" })).toMatch(/future/);
  });
  it("review state", () => {
    expect(reviewState("2026-10-31", "2026-11-01")).toBe("OVERDUE");
    expect(reviewState("2026-11-20", "2026-11-01")).toBe("DUE_SOON");
    expect(reviewState("2027-11-01", "2026-11-01")).toBe("OK");
    expect(reviewState(null, "2026-11-01")).toBe("NONE");
    expect(addMonths("2026-11-01", 12)).toBe("2027-11-01");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
  });
  it("who must acknowledge", () => {
    expect(mustAcknowledge("CASHIER", ["CASHIER", "MANAGER"])).toBe(true);
    expect(mustAcknowledge("TECHNICIAN", ["CASHIER"])).toBe(false);
    expect(validateRoles([])).not.toBeNull();
    expect(validateRoles(["OWNER", "BOSS"])).toMatch(/Unknown/);
    const staff = [{ id: 1, role: "CASHIER", active: true }, { id: 2, role: "CASHIER", active: true }, { id: 3, role: "CASHIER", active: false }, { id: 4, role: "TECHNICIAN", active: true }];
    expect(pendingAcknowledgements(staff, ["CASHIER"], new Set([1]))).toEqual([2]);
  });
  it("seed matches the pack: 20 unique ids, ten written", () => {
    expect(SOP_SEED).toHaveLength(20);
    expect(new Set(SOP_SEED.map((s) => s.sopId)).size).toBe(20);
    expect(SOP_SEED.filter((s) => s.draft)).toHaveLength(10);
    for (const s of SOP_SEED) { expect(validateRoles(s.applicable)).toBeNull(); if (s.draft) expect(validateDraft({ body: s.draft.steps.join("\n"), purpose: s.draft.purpose })).toBeNull(); }
  });
});
