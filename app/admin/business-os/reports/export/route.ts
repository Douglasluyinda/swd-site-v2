import { NextResponse } from "next/server";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { recordAuditEvent } from "@/lib/audit";
import { loadReport } from "@/lib/report-queries";
import { PRESETS, customPeriod, presetPeriod, toCsv, type Preset } from "@/lib/reports";

// CSV export. Permission is re-checked here — never rely on the page hiding the link.
export async function GET(req: Request) {
  const me = await getCurrentStaffSession();
  if (!me || !hasPermission(me.staffRole, "reports.view")) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from"), to = url.searchParams.get("to"), range = url.searchParams.get("range");
  const kind = url.searchParams.get("kind") === "products" ? "products" : "daily";
  let period;
  if (from && to) {
    const c = customPeriod(from, to);
    if (typeof c === "string") return new NextResponse(c, { status: 400 });
    period = c;
  } else {
    period = presetPeriod((PRESETS as readonly string[]).includes(range ?? "") ? (range as Preset) : "this-week", new Date());
  }

  const r = await loadReport(period);
  const csv = kind === "products"
    ? toCsv(["SKU", "Product", "Units", "Sales UGX", "Cost UGX", "Profit UGX"], r.topProducts.map((p) => [p.sku, p.title, p.units, p.revenue, p.cost, p.revenue - p.cost]))
    : toCsv(
        ["Day", "Sales count", "Sales UGX", "Discounts UGX", "Refunds UGX", "Repair revenue UGX", "Revenue UGX", "Goods cost UGX", "Repair cost UGX", "Gross profit UGX", "Expenses UGX", "Operating profit (estimate) UGX", "Supplier payments UGX"],
        [...r.rows, r.totals].map((d) => [d.day, d.salesCount, d.sales, d.discounts, d.refunds, d.repairRevenue, d.revenue, d.cogs, d.repairCost, d.grossProfit, d.expenses, d.operatingProfit, d.supplierPayments]),
      );

  await recordAuditEvent({ actorId: Number(me.adminId), actorEmail: me.email, action: "report.exported", entityType: "report", entityId: 0, metadata: { kind, from: period.from.toISOString(), to: period.to.toISOString() } });
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="swd-${kind}-${period.from.toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
