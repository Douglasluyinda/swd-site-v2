import { getDashboardMetrics } from "@/lib/analytics";

export default async function AdminAnalyticsPage() {
  const metrics = await getDashboardMetrics();
  const maxDayRevenue = Math.max(1, ...metrics.revenueByDay.map((d) => d.revenue));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy">Analytics</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate">
        Two separate things live here. Revenue and order-status data below is
        real, computed from this database on every page load. Page-level
        traffic (visits, device/browser breakdown, page load performance) is
        tracked separately by Vercel Web Analytics and Speed Insights —
        both are wired into every page, but only report data once this app
        is deployed on Vercel; view those numbers on your{" "}
        <a
          href="https://vercel.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue hover:underline"
        >
          Vercel dashboard
        </a>
        . Event-level product analytics (views, add-to-cart, checkout funnel
        drop-off) aren&apos;t built — that needs a client-side event layer
        (e.g. PostHog or Vercel Analytics custom events), not just a provider
        key.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-white p-4">
        <h2 className="font-semibold text-navy">Revenue, last 30 days</h2>
        {metrics.revenueByDay.length === 0 ? (
          <p className="mt-3 text-sm text-slate">No paid orders in the last 30 days.</p>
        ) : (
          <div className="mt-4 flex items-end gap-1" style={{ height: 120 }}>
            {metrics.revenueByDay.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: $${d.revenue.toFixed(2)}`}>
                <div
                  className="w-full rounded-t bg-blue/70"
                  style={{ height: `${Math.max(4, (d.revenue / maxDayRevenue) * 100)}%` }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-white p-4">
        <h2 className="font-semibold text-navy">Order funnel, last 30 days</h2>
        <div className="mt-3 space-y-2">
          {metrics.statusCounts.length === 0 && (
            <p className="text-sm text-slate">No orders in the last 30 days.</p>
          )}
          {metrics.statusCounts
            .sort((a, b) => b.count - a.count)
            .map((s) => (
              <div key={s.status} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 text-slate">{s.status}</span>
                <div className="h-2 flex-1 rounded-full bg-light">
                  <div
                    className="h-2 rounded-full bg-blue"
                    style={{
                      width: `${(s.count / Math.max(1, metrics.orderCount30d)) * 100}%`,
                    }}
                  />
                </div>
                <span className="w-8 text-right font-medium text-navy">{s.count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
