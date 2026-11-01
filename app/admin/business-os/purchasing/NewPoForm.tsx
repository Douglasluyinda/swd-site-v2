"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitPurchaseOrder } from "@/lib/admin-actions";

type P = { id: number; title: string; sku: string };
type S = { id: number; name: string };
type Line = { productId: string; quantity: string; unitCost: string };
const input = "rounded-lg border border-border-strong px-3 py-2 text-sm";

export function NewPoForm({ suppliers, products }: { suppliers: S[]; products: P[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState(String(suppliers[0]?.id ?? ""));
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "", unitCost: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (i: number, k: keyof Line, v: string) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function submit() {
    setBusy(true); setError(null);
    const r = await submitPurchaseOrder({
      supplierId: Number(supplierId), note,
      lines: lines.map((l) => ({ productId: Number(l.productId), quantity: Number(l.quantity), unitCost: Number(l.unitCost) })),
    });
    if (r.ok) router.push(`/admin/business-os/purchasing/${r.poNumber}`);
    else { setError(r.error); setBusy(false); }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-sm font-medium text-slate">New purchase order</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-label="Supplier" className={input}>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={input} />
      </div>
      <div className="mt-3 space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <select value={l.productId} onChange={(e) => set(i, "productId", e.target.value)} aria-label="Product" className={input}>
              <option value="">Choose product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.sku})</option>)}
            </select>
            <input type="number" min={1} value={l.quantity} onChange={(e) => set(i, "quantity", e.target.value)} placeholder="Qty" aria-label="Quantity" className={input} />
            <input type="number" min={1} value={l.unitCost} onChange={(e) => set(i, "unitCost", e.target.value)} placeholder="Unit cost (UGX)" aria-label="Unit cost" className={input} />
            <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} className="rounded-lg bg-light px-3 text-sm text-slate disabled:opacity-40">Remove</button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setLines((ls) => [...ls, { productId: "", quantity: "", unitCost: "" }])} className="mt-2 text-sm text-blue hover:underline">+ Add line</button>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <button onClick={submit} disabled={busy || !supplierId} className="mt-4 w-full rounded-lg bg-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
        {busy ? "Submitting…" : "Submit for approval"}
      </button>
    </div>
  );
}
