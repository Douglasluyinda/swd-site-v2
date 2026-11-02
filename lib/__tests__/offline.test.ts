import { describe, expect, it } from "vitest";
import { availableAfterQueue, isRetryable, priceMatches, provisionalReceipt, sessionCoversSale, syncOrder, validateOfflineSale, type OfflineSale } from "@/lib/offline";

const now = new Date("2026-11-02T10:00:00Z");
const sale: OfflineSale = { clientId: "0b8f3a52-8c1d-4a31-9f6e-111111111111", terminalId: "t1", employeeId: 1, occurredAt: "2026-11-02T09:30:00Z", lines: [{ productId: 1, quantity: 2 }], discountPercent: 0, expectedTotal: 20000, tendered: 20000 };

describe("offline rules", () => {
  it("accepts a normal queued sale", () => expect(validateOfflineSale(sale, now)).toBeNull());
  it("rejects bad input", () => {
    expect(validateOfflineSale({ ...sale, clientId: "x" }, now)).toMatch(/Invalid sale id/);
    expect(validateOfflineSale({ ...sale, lines: [] }, now)).toMatch(/no items/);
    expect(validateOfflineSale({ ...sale, tendered: 100 }, now)).toMatch(/tendered/);
    expect(validateOfflineSale({ ...sale, occurredAt: "2026-11-02T12:00:00Z" }, now)).toMatch(/future/);
    expect(validateOfflineSale({ ...sale, occurredAt: "2026-10-01T00:00:00Z" }, now)).toMatch(/older than 7 days/);
    expect(validateOfflineSale({ ...sale, occurredAt: "nope" }, now)).toMatch(/Invalid sale time/);
  });
  it("a sale must fall inside the open cash session", () => {
    expect(sessionCoversSale(new Date("2026-11-02T08:00:00Z"), new Date("2026-11-02T09:30:00Z"))).toBe(true);
    expect(sessionCoversSale(new Date("2026-11-02T09:45:00Z"), new Date("2026-11-02T09:30:00Z"))).toBe(false);
  });
  it("a price change is a conflict, never silently applied", () => {
    expect(priceMatches(20000, 20000)).toBeNull();
    expect(priceMatches(22000, 20000)).toMatch(/customer paid 20,000 UGX/);
  });
  it("provisional receipts are clearly not real receipts", () => expect(provisionalReceipt(sale.clientId)).toBe("PENDING-0B8F3A"));
  it("retry vs conflict", () => {
    expect(isRetryable("Not signed in.")).toBe(true);
    expect(isRetryable("Offline sales are switched off.")).toBe(true);
    expect(isRetryable("This would take stock below zero.")).toBe(false);
  });
  it("stock already sold offline is taken off what the till can still sell", () => {
    expect(availableAfterQueue(5, 1, [sale, sale])).toBe(1);
    expect(availableAfterQueue(3, 1, [sale, sale])).toBe(0);
    expect(availableAfterQueue(3, 2, [sale])).toBe(3);
  });
  it("syncs oldest first", () => {
    expect(syncOrder([{ occurredAt: "2026-11-02T09:00:00Z", n: 2 }, { occurredAt: "2026-11-02T08:00:00Z", n: 1 }]).map((x) => x.n)).toEqual([1, 2]);
  });
});
