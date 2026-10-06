// app/admin/analytics/page.tsx
export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-sm text-gray-500">
          Real-time customer traffic, product interactions, and checkout funnels.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <p className="text-sm text-gray-500">Analytics Engine</p>
          <p className="text-2xl font-semibold text-green-600">Active</p>
          <p className="text-xs text-gray-400 mt-1">@vercel/analytics & @vercel/speed-insights</p>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-blue-50 text-blue-900 text-sm">
        <p className="font-semibold">View Conversion Funnels & Traffic Insights</p>
        <p className="mt-1">
          Detailed metrics, top-selling products, and event breakdowns are tracking live on your{" "}
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold"
          >
            Vercel Dashboard
          </a>.
        </p>
      </div>
    </div>
  );
}