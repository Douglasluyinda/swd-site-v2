import { describe, expect, it } from "vitest";
import { buildDays, csvCell, customPeriod, daysIn, kampalaDateKey, kampalaDayStart, marginPercent, parseLocalDate, presetPeriod, toCsv, valueStock } from "@/lib/reports";

describe("Kampala periods", () => {
  it("a sale at 23:30 UTC is already tomorrow in Kampala", () => {
    expect(kampalaDateKey(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02");
    expect(kampalaDateKey(new Date("2026-11-01T20:59:00Z"))).toBe("2026-11-01");
  });
  it("day start is local midnight (21:00 UTC the day before)", () => {
    expect(kampalaDayStart(new Date("2026-11-01T12:00:00Z")).toISOString()).toBe("2026-10-31T21:00:00.000Z");
  });
  it("presets: Sunday 1 Nov 2026 — week is Mon 26 Oct..Sun 1 Nov", () => {
    const now = new Date("2026-11-01T18:00:00Z"); // 21:00 Sunday Kampala
    const w = presetPeriod("this-week", now);
    expect(kampalaDateKey(w.from)).toBe("2026-10-26");
    expect(daysIn(w)).toHaveLength(7);
    expect(kampalaDateKey(presetPeriod("last-week", now).from)).toBe("2026-10-19");
    const m = presetPeriod("this-month", now);
    expect(kampalaDateKey(m.from)).toBe("2026-11-01");
    expect(daysIn(m)).toHaveLength(30);
    expect(daysIn(presetPeriod("last-month", now))).toHaveLength(31);
    expect(kampalaDateKey(presetPeriod("yesterday", now).from)).toBe("2026-10-31");
  });
  it("custom range validation", () => {
    expect(parseLocalDate("2026-02-30")).toBeNull();
    expect(customPeriod("2026-11-05", "2026-11-01")).toMatch(/before/);
    expect(customPeriod("2025-01-01", "2026-11-01")).toMatch(/one year/);
    expect(typeof customPeriod("2026-11-01", "2026-11-03")).toBe("object");
    expect(daysIn(customPeriod("2026-11-01", "2026-11-03") as never)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
  });
});

describe("profit definitions", () => {
  const days = ["2026-11-01", "2026-11-02"];
  const raw = [
    { day: "2026-11-01", salesCount: 2, salesTotal: 100000, discounts: 5000, cogs: 60000, refunds: 20000, refundedCost: 12000, repairRevenue: 90000, repairCost: 40000, expenses: 10000, supplierPayments: 50000, linesWithoutCost: 1 },
  ];
  const { rows, totals, linesWithoutCost } = buildDays(raw, days);
  it("revenue nets refunds and adds repairs", () => expect(rows[0].revenue).toBe(100000 - 20000 + 90000));
  it("COGS gets returned goods' cost back", () => expect(rows[0].cogs).toBe(48000));
  it("gross profit = revenue − COGS − repair costs", () => expect(rows[0].grossProfit).toBe(170000 - 48000 - 40000));
  it("operating profit subtracts recorded expenses only; supplier payments are not an expense", () => {
    expect(rows[0].operatingProfit).toBe(82000 - 10000);
    expect(totals.supplierPayments).toBe(50000);
  });
  it("empty days are zero rows and the missing-cost count is surfaced", () => {
    expect(rows[1].revenue).toBe(0);
    expect(totals.revenue).toBe(rows[0].revenue);
    expect(linesWithoutCost).toBe(1);
  });
  it("margin", () => {
    expect(marginPercent(82000, 170000)).toBe(48.2);
    expect(marginPercent(0, 0)).toBeNull();
  });
});

describe("stock valuation and csv", () => {
  it("values stock at cost and reports unvalued units separately", () => {
    expect(valueStock([{ quantity: 3, unitCost: 1000 }, { quantity: 2, unitCost: null }, { quantity: -1, unitCost: 5 }])).toEqual({ value: 3000, units: 5, unvaluedUnits: 2 });
  });
  it("guards formula injection and escapes", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-1+2")).toBe("'-1+2");
    expect(csvCell(-5000)).toBe("-5000");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(toCsv(["a", "b"], [["x", 1]])).toBe("a,b\r\nx,1\r\n");
  });
});
