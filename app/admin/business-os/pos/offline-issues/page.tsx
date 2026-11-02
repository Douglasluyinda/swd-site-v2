import Link from "next/link";
import { desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, offlineSyncFailures, products } from "@/lib/db/schema";
import { getCurrentStaffSession } from "@/lib/staff-session";
import { hasPermission } from "@/lib/rbac";
import { resolveOfflineFailure } from "@/lib/admin-actions";
import { ActionForm } from "@/components/ActionForm";
import type { OfflineSale } from "@/lib/offline";

export default async function OfflineIssuesPage() {
  const me = await getCurrentStaffSession();
  if (!me || !hasPermission(me.staffRole, "cash.reconcile")) {
    return (
      <div className="rounded-xl border border-border bg-white p-6">
        <h1 className="text-xl font-semibold text-navy">Offline sale problems</h1>
        <p className="mt-2 text-sm text-slate">Only managers and the owner can review these.</p>
      </div>
    );
  }
  const rows = await db
    .select({ f: offlineSyncFailures, by: admins.name, email: admins.email })
    .from(offlineSyncFailures).leftJoin(admins, eq(admins.id, offlineSyncFailures.employeeId))
    .where(isNull(offlineSyncFailures.resolvedAt)).orderBy(desc(offlineSyncFailures.id)).limit(100);

  const parsed = rows.map((r) => { try { return JSON.parse(r.f.payload) as OfflineSale; } catch { return null; } });
  const ids = [...new Set(parsed.flatMap((p) => p?.lines.map((l) => l.productId) ?? []))];
  const titles = new Map((ids.length ? await db.select({ id: products.id, title: products.title }).from(products).where(inArray(products.id, ids)) : []).map((p) => [p.id, p.title]));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/business-os/pos" className="text-sm text-blue hover:underline">← Sales &amp; POS</Link>
        <h1 className="mt-2 text-2xl font-semibold text-navy">Offline sale problems</h1>
        <p className="mt-1 text-sm text-slate">
          These sales happened on the offline till — the customer already paid and left — but the server refused to record them.
          Fix the cause (e.g. receive stock, open a cash session), have the cashier press Retry on the till, or record how you settled it here.
        </p>
      </div>
      {rows.length === 0 && <p className="rounded-xl border border-border bg-white p-6 text-sm text-slate">Nothing waiting.</p>}
      {rows.map(({ f, by, email }, i) => {
        const sale = parsed[i];
        return (
          <div key={f.id} className="rounded-xl border border-border bg-white p-5 text-sm">
            <p className="font-medium text-navy">{f.reason}</p>
            <p className="mt-1 text-slate">
              {by ?? email} · sale made {f.occurredAt ? f.occurredAt.toISOString().slice(0, 16).replace("T", " ") : "?"} UTC · last tried {f.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC
            </p>
            {sale && (
              <p className="mt-2 text-navy">
                {sale.lines.map((l) => `${l.quantity} × ${titles.get(l.productId) ?? `product ${l.productId}`}`).join(", ")} — paid {sale.expectedTotal.toLocaleString()} UGX cash{sale.customerPhone ? ` · ${sale.customerPhone}` : ""}
              </p>
            )}
            <ActionForm action={resolveOfflineFailure} className="mt-3 flex flex-wrap gap-2">
              <input type="hidden" name="id" value={f.id} />
              <input name="note" required placeholder="How was this settled?" className="min-w-64 flex-1 rounded-lg border border-border-strong px-3 py-2 text-sm" />
              <button className="rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border">Mark resolved</button>
            </ActionForm>
          </div>
        );
      })}
    </div>
  );
}
