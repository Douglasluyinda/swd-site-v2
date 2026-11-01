// Pure reporting rules (no DB). Money is whole UGX.
//
// Definitions (kept separate on purpose — they are different numbers):
//   Revenue       = shop sales (after discounts) − refunds + repair payments
//   Cash in       = cash actually taken (sales + repair payments − refunds)
//   Gross profit  = revenue − cost of goods sold − repair direct costs
//   Operating profit (estimate) = gross profit − expenses recorded through
//                   the cash drawer. Rent, salaries, etc. are NOT tracked yet,
//                   so this is an upper bound, not a final figure.
// Stock purchases and supplier payments are not expenses: they turn cash
// into inventory and show up as cash out / inventory value.
// Online-store orders are not in these reports yet.

export const KAMPALA_OFFSET_HOURS = 3; // UTC+3, no DST

export type Period = { from: Date; to: Date; label: string }; // [from, to) in UTC

const DAY = 86_400_000;

// Start of the Kampala calendar day containing `now`, as a UTC instant.
export function kampalaDayStart(now: Date): Date {
  const shifted = new Date(now.getTime() + KAMPALA_OFFSET_HOURS * 3_600_000);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(midnight - KAMPALA_OFFSET_HOURS * 3_600_000);
}

export function kampalaDateKey(d: Date): string {
  return new Date(d.getTime() + KAMPALA_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

// Local date string "YYYY-MM-DD" → UTC instant of that local midnight.
export function parseLocalDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const d = new Date(t);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
  return new Date(t - KAMPALA_OFFSET_HOURS * 3_600_000);
}

export const PRESETS = ["today", "yesterday", "this-week", "last-week", "this-month", "last-month"] as const;
export type Preset = (typeof PRESETS)[number];

export function presetPeriod(preset: Preset, now: Date): Period {
  const today = kampalaDayStart(now);
  const local = new Date(today.getTime() + KAMPALA_OFFSET_HOURS * 3_600_000);
  const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
  const monthStart = (y: number, m: number) => new Date(Date.UTC(y, m, 1) - KAMPALA_OFFSET_HOURS * 3_600_000);
  const y = local.getUTCFullYear(), m = local.getUTCMonth();
  switch (preset) {
    case "today": return { from: today, to: new Date(today.getTime() + DAY), label: "Today" };
    case "yesterday": return { from: new Date(today.getTime() - DAY), to: today, label: "Yesterday" };
    case "this-week": { const from = new Date(today.getTime() - dow * DAY); return { from, to: new Date(from.getTime() + 7 * DAY), label: "This week (Mon–Sun)" }; }
    case "last-week": { const to = new Date(today.getTime() - dow * DAY); return { from: new Date(to.getTime() - 7 * DAY), to, label: "Last week" }; }
    case "this-month": return { from: monthStart(y, m), to: monthStart(y, m + 1), label: "This month" };
    case "last-month": return { from: monthStart(y, m - 1), to: monthStart(y, m), label: "Last month" };
  }
}

// Custom range from two inclusive local dates. Capped at 366 days.
export function customPeriod(fromStr: string, toStr: string): Period | string {
  const from = parseLocalDate(fromStr), lastDay = parseLocalDate(toStr);
  if (!from || !lastDay) return "Enter dates as YYYY-MM-DD.";
  if (lastDay < from) return "The end date is before the start date.";
  const to = new Date(lastDay.getTime() + DAY);
  if ((to.getTime() - from.getTime()) / DAY > 366) return "Pick a range of at most one year.";
  return { from, to, label: `${fromStr} to ${toStr}` };
}

export type DayRaw = {
  day: string; // Kampala local date
  salesCount?: number; salesTotal?: number; discounts?: number; cogs?: number; linesWithoutCost?: number;
  refunds?: number; refundedCost?: number;
  repairRevenue?: number; repairCost?: number;
  expenses?: number; supplierPayments?: number;
};

export type DayRow = {
  day: string; salesCount: number; sales: number; discounts: number; refunds: number; repairRevenue: number;
  revenue: number; cogs: number; repairCost: number; grossProfit: number; expenses: number; operatingProfit: number;
  supplierPayments: number;
};

export function buildDays(raw: DayRaw[], days: string[]): { rows: DayRow[]; totals: DayRow; linesWithoutCost: number } {
  const by = new Map(raw.map((r) => [r.day, r]));
  let linesWithoutCost = 0;
  const rows = days.map((day) => {
    const r = by.get(day) ?? { day };
    linesWithoutCost += r.linesWithoutCost ?? 0;
    const sales = r.salesTotal ?? 0, refunds = r.refunds ?? 0, repairRevenue = r.repairRevenue ?? 0;
    const revenue = sales - refunds + repairRevenue;
    const cogs = (r.cogs ?? 0) - (r.refundedCost ?? 0); // returned goods' cost comes back
    const repairCost = r.repairCost ?? 0;
    const grossProfit = revenue - cogs - repairCost;
    const expenses = r.expenses ?? 0;
    return {
      day, salesCount: r.salesCount ?? 0, sales, discounts: r.discounts ?? 0, refunds, repairRevenue, revenue, cogs, repairCost,
      grossProfit, expenses, operatingProfit: grossProfit - expenses, supplierPayments: r.supplierPayments ?? 0,
    };
  });
  const sum = (k: keyof Omit<DayRow, "day">) => rows.reduce((a, r) => a + r[k], 0);
  const totals: DayRow = {
    day: "TOTAL", salesCount: sum("salesCount"), sales: sum("sales"), discounts: sum("discounts"), refunds: sum("refunds"),
    repairRevenue: sum("repairRevenue"), revenue: sum("revenue"), cogs: sum("cogs"), repairCost: sum("repairCost"),
    grossProfit: sum("grossProfit"), expenses: sum("expenses"), operatingProfit: sum("operatingProfit"), supplierPayments: sum("supplierPayments"),
  };
  return { rows, totals, linesWithoutCost };
}

export function daysIn(period: Period): string[] {
  const out: string[] = [];
  for (let t = period.from.getTime(); t < period.to.getTime(); t += DAY) out.push(kampalaDateKey(new Date(t)));
  return out;
}

// Cash taken in the period. Cash-only today, so it equals revenue; kept as
// its own figure so mobile money/card can diverge later without changing meaning.
export function cashIn(day: Pick<DayRow, "revenue">): number {
  return day.revenue;
}

export function marginPercent(grossProfit: number, revenue: number): number | null {
  return revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null;
}

export function valueStock(rows: { quantity: number; unitCost: number | null }[]) {
  let value = 0, units = 0, unvaluedUnits = 0;
  for (const r of rows) {
    if (r.quantity <= 0) continue;
    units += r.quantity;
    if (r.unitCost == null) unvaluedUnits += r.quantity;
    else value += r.quantity * r.unitCost;
  }
  return { value, units, unvaluedUnits };
}

// CSV with spreadsheet-formula injection guarded: a cell that starts with
// = + - @ (or tab/CR) gets a leading apostrophe. Real negative numbers are
// written as numbers, not text, so they pass through untouched.
export function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
