import Link from "next/link";
import { getDashboardMetrics } from "@/lib/analytics";

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Dashboard</h1>
      <p className="mt-1 text-sm text-slate">Last 30 days, computed live from the database.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-slate">Revenue (paid orders)</p>
          <p className="mt-1 text-2xl font-semibold text-navy">${metrics.revenue30d.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-slate">Orders placed</p>
          <p className="mt-1 text-2xl font-semibold text-navy">{metrics.orderCount30d}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-sm text-slate">Average order value</p>
          <p className="mt-1 text-2xl font-semibold text-navy">
            ${metrics.averageOrderValue30d.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4">
          <h2 className="font-semibold text-navy">Orders by status</h2>
          <div className="mt-3 space-y-2">
            {metrics.statusCounts.length === 0 && (
              <p className="text-sm text-slate">No orders in the last 30 days.</p>
            )}
            {metrics.statusCounts
              .sort((a, b) => b.count - a.count)
              .map((s) => (
                <div key={s.status} className="flex items-center justify-between text-sm">
                  <span className="text-slate">{s.status}</span>
                  <span className="font-medium text-navy">{s.count}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <h2 className="font-semibold text-navy">Top products by revenue</h2>
          <div className="mt-3 space-y-2">
            {metrics.topProducts.length === 0 && (
              <p className="text-sm text-slate">No sales in the last 30 days.</p>
            )}
            {metrics.topProducts.map((p) => (
              <div key={p.title} className="flex items-center justify-between text-sm">
                <span className="text-slate">
                  {p.title} <span className="text-xs">× {p.unitsSold}</span>
                </span>
                <span className="font-medium text-navy">${p.revenue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-light p-4 text-sm text-slate">
        Page-level traffic (visits, bounce rate, load performance) is tracked by Vercel Web
        Analytics and Speed Insights once this app is deployed on Vercel — see the{" "}
        <Link href="/admin/analytics" className="text-blue hover:underline">
          Analytics
        </Link>{" "}
        page.
      </div>
    </div>
  );
}
