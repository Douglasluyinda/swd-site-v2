"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { completeSale } from "@/lib/admin-actions";
import { computeSale } from "@/lib/pos";

type Item = { id: number; title: string; sku: string; price: number; onHand: number };

export function PosTerminal({ items, maxDiscount }: { items: Item[]; maxDiscount: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [discount, setDiscount] = useState(0);
  const [tendered, setTendered] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One key per cart attempt: a double-click or network retry resubmits the
  // same key, so the server returns the original sale instead of a duplicate.
  const [key, setKey] = useState(() => crypto.randomUUID());

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const shown = items
    .filter((i) => {
      const q = query.trim().toLowerCase();
      return !q || i.title.toLowerCase().includes(q) || i.sku.toLowerCase() === q || i.sku.toLowerCase().includes(q);
    })
    .slice(0, 12);

  const lines = Object.entries(cart).map(([id, quantity]) => ({
    productId: Number(id),
    quantity,
    unitPrice: byId.get(Number(id))!.price,
  }));
  const totals = computeSale(lines, discount);
  const tenderedNum = Math.round(Number(tendered) || 0);
  const change = tenderedNum - totals.total;

  function add(i: Item) {
    setCart((c) => ({ ...c, [i.id]: Math.min((c[i.id] ?? 0) + 1, i.onHand) }));
  }
  function setQty(id: number, q: number) {
    setCart((c) => {
      const next = { ...c };
      if (q <= 0) delete next[id];
      else next[id] = Math.min(q, byId.get(id)!.onHand);
      return next;
    });
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await completeSale({
      idempotencyKey: key,
      lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
      discountPercent: discount,
      tendered: tenderedNum,
      customerName,
      customerPhone,
    });
    if (r.ok) {
      setKey(crypto.randomUUID());
      router.push(`/admin/business-os/pos/receipt/${r.receiptNumber}`);
    } else {
      setError(r.error);
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-white p-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or scan/enter SKU"
          aria-label="Search products"
          className="w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
        />
        <ul className="mt-3 divide-y divide-border">
          {shown.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p className="text-navy">{i.title}</p>
                <p className="text-xs text-slate">{i.sku} · {i.onHand} in stock · {i.price.toLocaleString()} UGX</p>
              </div>
              <button
                disabled={i.onHand <= 0}
                onClick={() => add(i)}
                className="rounded-lg bg-light px-3 py-1.5 text-xs font-medium text-navy hover:bg-border disabled:opacity-40"
              >
                {i.onHand <= 0 ? "Out" : "Add"}
              </button>
            </li>
          ))}
          {shown.length === 0 && <li className="py-6 text-center text-sm text-slate">No matching products.</li>}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <p className="text-sm font-medium text-slate">Cart</p>
        <ul className="mt-2 divide-y divide-border">
          {lines.map((l) => {
            const i = byId.get(l.productId)!;
            return (
              <li key={l.productId} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="text-navy">{i.title}</span>
                <span className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={i.onHand} value={l.quantity}
                    aria-label={`Quantity for ${i.title}`}
                    onChange={(e) => setQty(l.productId, Math.floor(Number(e.target.value)))}
                    className="w-16 rounded-lg border border-border-strong px-2 py-1 text-sm"
                  />
                  <span className="w-24 text-right text-slate">{(l.unitPrice * l.quantity).toLocaleString()}</span>
                </span>
              </li>
            );
          })}
          {lines.length === 0 && <li className="py-6 text-center text-sm text-slate">Cart is empty.</li>}
        </ul>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name (optional)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (optional)" className="rounded-lg border border-border-strong px-3 py-2 text-sm" />
          <label className="text-xs text-slate">
            Discount % (your limit: {maxDiscount}%)
            <input
              type="number" min={0} max={maxDiscount} step="0.5" value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              disabled={maxDiscount === 0}
              className="mt-1 w-full rounded-lg border border-border-strong px-3 py-2 text-sm disabled:bg-light"
            />
          </label>
          <label className="text-xs text-slate">
            Cash tendered (UGX)
            <input
              type="number" min={0} value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border-strong px-3 py-2 text-sm"
            />
          </label>
        </div>

        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate">Subtotal</dt><dd>{totals.subtotal.toLocaleString()}</dd></div>
          <div className="flex justify-between"><dt className="text-slate">Discount</dt><dd>-{totals.discount.toLocaleString()}</dd></div>
          <div className="flex justify-between text-base font-semibold text-navy"><dt>Total</dt><dd>{totals.total.toLocaleString()} UGX</dd></div>
          <div className="flex justify-between"><dt className="text-slate">Change due</dt><dd>{change >= 0 && lines.length ? change.toLocaleString() : "—"}</dd></div>
        </dl>
        <p className="mt-2 text-xs text-slate">Cash only for now. Mobile money and card need separate payment verification and aren&apos;t enabled.</p>

        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || lines.length === 0 || tenderedNum < totals.total}
          className="mt-4 w-full rounded-lg bg-blue px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? "Completing…" : "Complete cash sale"}
        </button>
      </div>
    </div>
  );
}
