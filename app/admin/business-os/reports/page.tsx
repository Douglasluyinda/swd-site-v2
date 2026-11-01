import Link from "next/link";
import { getCurrentStaffSession } from "@/lib/admin-auth";
import { hasPermission } from "@/lib/rbac";
import { loadReport, loadStockValuation } from "@/lib/report-queries";
import { PRESETS, customPeriod, kampalaDateKey, marginPercent, presetPeriod, type Preset } from "@/lib/reports";

const fmt = (n: number) => n.toLocaleString("en-US");
const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <p className="text-xs font-medium text-slate">{label}</p>
      <p className="mt-1 text-xl font-semibold text-navy">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate">{sub}</p>}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const me = await getCurrentStaffSession();
  if (!hasPermission(me?.staffRole, "reports.view")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Reports</h1>
        <p className="mt-2 text-sm text-slate">Your role does not have access to reports.</p>
      </div>
    );
  }
  const sp = await searchParams;
  const now = new Date();
  let period = presetPeriod("this-week", now);
  let query = "range=this-week";
  let error: string | null = null;
  if (sp.from && sp.to) {
    const c = customPeriod(sp.from, sp.to);
    if (typeof c === "string") error = c; else { period = c; query = `from=${sp.from}&to=${sp.to}`; }
  } else if (sp.range && (PRESETS as readonly string[]).includes(sp.range)) {
    period = presetPeriod(sp.range as Preset, now); query = `range=${sp.range}`;
  }

  const [r, stock] = await Promise.all([loadReport(period), loadStockValuation()]);
  const t = r.totals;
  const margin = marginPercent(t.grossProfit, t.revenue);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Reports</h1>
        <p className="mt-1 text-sm text-slate">{period.label} · {kampalaDateKey(period.from)} to {kampalaDateKey(new Date(period.to.getTime() - 1))} (Kampala time)</p>
      </div>

      <div className="flex flex-wrap items-end gap-2 text-sm">
        {PRESETS.map((p) => (
          <Link key={p} href={`/admin/business-os/reports?range=${p}`} className="rounded-full bg-light px-3 py-1 text-navy hover:bg-border">{p.replace("-", " ")}</Link>
        ))}
        <form className="ml-auto flex flex-wrap items-center gap-2" action="/admin/business-os/reports">
          <input type="date" name="from" defaultValue={sp.from} aria-label="From" className={input} />
          <input type="date" name="to" defaultValue={sp.to} aria-label="To" className={input} />
          <button className="rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border">Show</button>
        </form>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={`${fmt(t.revenue)} UGX`} sub={`Shop sales ${fmt(t.sales)} − refunds ${fmt(t.refunds)} + repairs ${fmt(t.repairRevenue)}`} />
        <Stat label="Cash taken in" value={`${fmt(t.revenue)} UGX`} sub="Cash only for now, so equal to revenue" />
        <Stat label="Gross profit" value={`${fmt(t.grossProfit)} UGX`} sub={margin == null ? undefined : `${margin}% margin · after goods and repair costs`} />
        <Stat label="Operating profit (estimate)" value={`${fmt(t.operatingProfit)} UGX`} sub={`After ${fmt(t.expenses)} recorded drawer expenses`} />
      </div>

      {r.linesWithoutCost > 0 && (
        <p role="note" className="rounded-lg border border-border bg-light p-3 text-sm text-navy">
          {r.linesWithoutCost} sold item line(s) had no cost price, so their cost counted as 0 and gross profit is overstated. Add cost prices in Inventory/Products.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium text-slate">Day by day</p>
          <span className="flex gap-3 text-sm">
            <Link className="text-blue hover:underline" href={`/admin/business-os/reports/export?${query}&kind=daily`}>Download CSV</Link>
          </span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-border text-slate">
            <tr>{["Day", "Sales", "Refunds", "Repairs", "Revenue", "Goods cost", "Repair cost", "Gross profit", "Expenses", "Operating"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {[...r.rows, r.totals].map((d) => (
              <tr key={d.day} className={`border-b border-border last:border-0 ${d.day === "TOTAL" ? "font-semibold text-navy" : "text-slate"}`}>
                <td className="px-3 py-2">{d.day === "TOTAL" ? "Total" : d.day}</td>
                <td className="px-3 py-2">{fmt(d.sales)}</td><td className="px-3 py-2">{fmt(d.refunds)}</td><td className="px-3 py-2">{fmt(d.repairRevenue)}</td>
                <td className="px-3 py-2">{fmt(d.revenue)}</td><td className="px-3 py-2">{fmt(d.cogs)}</td><td className="px-3 py-2">{fmt(d.repairCost)}</td>
                <td className="px-3 py-2">{fmt(d.grossProfit)}</td><td className="px-3 py-2">{fmt(d.expenses)}</td><td className="px-3 py-2">{fmt(d.operatingProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Cash reconciliation (sessions closed in period)</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate">Sessions closed</dt><dd className="text-navy">{r.cash.sessionsClosed}</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Sessions with a variance</dt><dd className="text-navy">{r.cash.withVariance}</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Net variance (counted − expected)</dt><dd className="text-navy">{fmt(r.cash.netVariance)} UGX</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Awaiting approval</dt><dd className="text-navy">{r.cash.pendingApproval}</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Paid to suppliers (cash out, not an expense)</dt><dd className="text-navy">{fmt(t.supplierPayments)} UGX</dd></div>
          </dl>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="text-sm font-medium text-slate">Stock right now (at cost)</p>
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate">Inventory value</dt><dd className="text-navy">{fmt(stock.value)} UGX</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Units in stock</dt><dd className="text-navy">{fmt(stock.units)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Units with no cost price (not valued)</dt><dd className="text-navy">{fmt(stock.unvaluedUnits)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate">Products at or below reorder level</dt><dd className="text-navy">{stock.lowStockCount}</dd></div>
          </dl>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-medium text-slate">Top products by sales</p>
          <Link className="text-sm text-blue hover:underline" href={`/admin/business-os/reports/export?${query}&kind=products`}>Download CSV</Link>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="border-y border-border text-slate"><tr>{["Product", "Units", "Sales", "Cost", "Profit"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {r.topProducts.map((p) => (
              <tr key={p.sku} className="border-b border-border last:border-0 text-slate">
                <td className="px-3 py-2 text-navy">{p.title}</td><td className="px-3 py-2">{fmt(p.units)}</td><td className="px-3 py-2">{fmt(p.revenue)}</td><td className="px-3 py-2">{fmt(p.cost)}</td><td className="px-3 py-2">{fmt(p.revenue - p.cost)}</td>
              </tr>
            ))}
            {r.topProducts.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-slate">No sales in this period.</td></tr>}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-slate">Before refunds (refunds are shown against the day they happened above).</p>
      </div>

      <details className="rounded-xl border border-border bg-white p-5 text-sm text-slate">
        <summary className="cursor-pointer font-medium text-navy">How these numbers are defined</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li><b>Revenue</b>: shop sales after discounts, minus refunds, plus repair payments (counted the day the device is handed over).</li>
          <li><b>Cash taken in</b>: money actually received. Equal to revenue while only cash is accepted.</li>
          <li><b>Gross profit</b>: revenue minus the cost of goods sold (returned goods give their cost back) and repair parts/external technician costs.</li>
          <li><b>Operating profit (estimate)</b>: gross profit minus expenses recorded through the cash drawer. Rent, salaries and other costs are not tracked yet, so treat it as an upper bound.</li>
          <li>Stock purchases and supplier payments are not expenses; they move cash into inventory.</li>
          <li>Online-store orders are not included yet. Days are Kampala calendar days.</li>
        </ul>
      </details>
    </div>
  );
}
