import { describe, expect, it } from "vitest";
import {
  amountDue, canTransition, repairMargin, ticketNumber, validateApproval, validateCollect,
  validateIntake, validatePart, validateQuote, validateTransition,
} from "@/lib/repairs";

const base = { technicianId: 5, actorId: 5, actorRole: "TECHNICIAN", canManage: false, note: "x", diagnosis: "cracked board" } as const;

describe("repair rules", () => {
  it("only allows the defined path", () => {
    expect(canTransition("RECEIVED", "DIAGNOSING")).toBe(true);
    expect(canTransition("RECEIVED", "IN_REPAIR")).toBe(false); // cannot skip quote + approval
    expect(canTransition("QUOTED", "IN_REPAIR")).toBe(false);
    expect(canTransition("COLLECTED", "READY")).toBe(false);
  });
  it("dedicated steps are refused through the generic path", () => {
    expect(validateTransition({ ...base, from: "QUOTED", to: "APPROVED", canManage: true })).toMatch(/own button/);
    expect(validateTransition({ ...base, from: "READY", to: "COLLECTED", canManage: true })).toMatch(/own button/);
  });
  it("technician only moves own tickets and only to bench statuses", () => {
    expect(validateTransition({ ...base, from: "APPROVED", to: "IN_REPAIR" })).toBeNull();
    expect(validateTransition({ ...base, from: "APPROVED", to: "IN_REPAIR", technicianId: 9 })).toMatch(/assigned to you/);
    expect(validateTransition({ ...base, from: "APPROVED", to: "CANCELLED" })).toMatch(/manager/);
  });
  it("technician cannot pass their own quality check, owner can", () => {
    expect(validateTransition({ ...base, from: "QUALITY_CHECK", to: "READY", canManage: true, actorRole: "MANAGER" })).toMatch(/someone other/);
    expect(validateTransition({ ...base, from: "QUALITY_CHECK", to: "READY", canManage: true, actorRole: "OWNER" })).toBeNull();
    expect(validateTransition({ ...base, from: "QUALITY_CHECK", to: "READY", canManage: true, actorId: 7, actorRole: "MANAGER" })).toBeNull();
  });
  it("needs diagnosis before QC, reason to cancel or fail QC", () => {
    expect(validateTransition({ ...base, from: "IN_REPAIR", to: "QUALITY_CHECK", diagnosis: " " })).toMatch(/diagnosis/);
    expect(validateTransition({ ...base, from: "RECEIVED", to: "CANCELLED", canManage: true, note: "" })).toMatch(/reason/);
    expect(validateTransition({ ...base, from: "QUALITY_CHECK", to: "IN_REPAIR", canManage: true, note: "" })).toMatch(/failed/);
  });
  it("needs a technician before diagnosing", () => {
    expect(validateTransition({ ...base, from: "RECEIVED", to: "DIAGNOSING", canManage: true, technicianId: null })).toMatch(/Assign/);
  });
  it("validates intake, quote, approval, parts", () => {
    expect(validateIntake({ deviceType: "", issue: "x" })).not.toBeNull();
    expect(validateIntake({ deviceType: "Phone", issue: "no power", imei: "35-123456" })).toBeNull();
    expect(validateIntake({ deviceType: "Phone", issue: "no power", imei: "!!" })).not.toBeNull();
    expect(validateQuote({ amount: 50000, externalCost: 0 })).toBeNull();
    expect(validateQuote({ amount: 1.5, externalCost: 0 })).not.toBeNull();
    expect(validateQuote({ amount: 50000, externalCost: 10000 })).toMatch(/external technician/);
    expect(validateApproval({ status: "DIAGNOSING", quoteAmount: null, note: "ok" })).not.toBeNull();
    expect(validateApproval({ status: "QUOTED", quoteAmount: 1, note: "" })).toMatch(/how the customer/);
    expect(validatePart({ status: "APPROVED", quantity: 1 })).toMatch(/In repair/);
    expect(validatePart({ status: "IN_REPAIR", quantity: 0 })).not.toBeNull();
  });
  it("collection needs a cash session only when money is due", () => {
    expect(amountDue("READY", 80000, 0)).toBe(80000);
    expect(amountDue("DECLINED", 80000, 0)).toBe(0);
    expect(validateCollect({ status: "READY", due: 80000, hasOpenSession: false })).toMatch(/cash session/);
    expect(validateCollect({ status: "READY", due: 0, hasOpenSession: false })).toBeNull();
    expect(validateCollect({ status: "IN_REPAIR", due: 0, hasOpenSession: true })).toMatch(/not ready/);
  });
  it("margin and numbering", () => {
    expect(repairMargin(100000, 30000, 20000)).toBe(50000);
    expect(ticketNumber(2026, 42)).toBe("SWD-RP-2026-000042");
  });
});
