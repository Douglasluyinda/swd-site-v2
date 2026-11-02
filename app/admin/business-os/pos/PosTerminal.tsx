"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { completeSale, registerOfflineTerminal, syncOfflineSale } from "@/lib/admin-actions";
import { computeSale } from "@/lib/pos";
import { availableAfterQueue, type OfflineSale } from "@/lib/offline";
import { clearSynced, enqueue, getMeta, listQueue, recoverInterrupted, setMeta, updateItem, type QueuedSale } from "@/lib/offline-queue";

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

type Item = { id: number; title: string; sku: string; price: number; onHand: number };

export function PosTerminal({
  items: serverItems, maxDiscount, offlineEnabled, employeeId, canRegisterTerminal, catalogueAt,
}: { items: Item[]; maxDiscount: number; offlineEnabled: boolean; employeeId: number; canRegisterTerminal: boolean; catalogueAt: string }) {
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

  // --- offline support (only active on the one registered terminal) ---
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState<{ q: QueuedSale; change: number; titles: string[] } | null>(null);
  const offlineReady = offlineEnabled && !!terminalId;

  const refreshQueue = useCallback(async () => { try { setQueue(await listQueue()); } catch { /* no IndexedDB */ } }, []);

  const syncAll = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      for (const item of (await listQueue()).filter((i) => i.status === "PENDING_SYNC" && i.sale.employeeId === employeeId)) {
        await updateItem(item.sale.clientId, { status: "SYNCING", attempts: item.attempts + 1 });
        let r;
        try { r = await syncOfflineSale(item.sale); } catch { await updateItem(item.sale.clientId, { status: "PENDING_SYNC" }); break; }
        if (r.ok) await updateItem(item.sale.clientId, { status: "SYNCED", receiptNumber: r.receiptNumber, error: undefined });
        else if (r.retryable) { await updateItem(item.sale.clientId, { status: "PENDING_SYNC", error: r.error }); setNotice(r.error); break; }
        else await updateItem(item.sale.clientId, { status: "FAILED", error: r.error });
      }
    } finally {
      setSyncing(false);
      await refreshQueue();
    }
  }, [employeeId, refreshQueue]);

  useEffect(() => {
    const on = () => { void syncAll(); };
    window.addEventListener("online", on);
    return () => { window.removeEventListener("online", on); };
  }, [syncAll]);

  useEffect(() => {
    if (!offlineEnabled) return;
    (async () => {
      try {
        await recoverInterrupted();
        const id = (await getMeta<string>("terminalId")) ?? null;
        setTerminalId(id);
        await refreshQueue();
        if (id && "serviceWorker" in navigator) {
          await setMeta("catalogueAt", catalogueAt);
          await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          // Keep the page and its scripts so the till opens with no internet.
          const cache = await caches.open("swd-pos-shell-v1");
          const urls = new Set<string>();
          document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]").forEach((el) => {
            const u = new URL((el as HTMLScriptElement).src || (el as HTMLLinkElement).href, location.href);
            if (u.origin === location.origin && u.pathname.startsWith("/_next/static/")) urls.add(u.pathname + u.search);
          });
          performance.getEntriesByType("resource").forEach((e) => { const u = new URL(e.name); if (u.origin === location.origin && u.pathname.startsWith("/_next/static/")) urls.add(u.pathname + u.search); });
          await Promise.all([...urls].map((u) => cache.match(u).then(async (h) => { if (!h) await cache.add(u); }).catch(() => undefined)));
          await fetch("/admin/business-os/pos", { headers: { "x-swd-warm": "1" }, credentials: "same-origin" }).catch(() => undefined);
          if (navigator.onLine) void syncAll();
        }
      } catch { /* offline mode unavailable in this browser */ }
    })();
  }, [offlineEnabled, catalogueAt, refreshQueue, syncAll]);

  // What the till can still sell: the page's stock snapshot minus sales queued since it was taken.
  const items = useMemo(() => {
    const since = queue.filter((q) => q.sale.occurredAt > catalogueAt).map((q) => q.sale);
    return serverItems.map((i) => ({ ...i, onHand: availableAfterQueue(i.onHand, i.id, since) }));
  }, [serverItems, queue, catalogueAt]);

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

  async function queueOffline() {
    const sale: OfflineSale = {
      clientId: key, terminalId: terminalId!, employeeId, occurredAt: new Date().toISOString(),
      lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
      discountPercent: discount, expectedTotal: totals.total, tendered: tenderedNum,
      customerName: customerName || undefined, customerPhone: customerPhone || undefined,
    };
    try {
      const q = await enqueue(sale); // durable BEFORE we tell the cashier it is saved
      setSavedOffline({ q, change, titles: lines.map((l) => `${l.quantity} × ${byId.get(l.productId)!.title}`) });
      setCart({}); setDiscount(0); setTendered(""); setCustomerName(""); setCustomerPhone(""); setKey(crypto.randomUUID());
      await refreshQueue();
    } catch {
      setError("Could not save this sale on the device. Do not hand over the goods until it is recorded.");
    }
    setBusy(false);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    if (offlineReady && !navigator.onLine) return queueOffline();
    let r;
    try {
      r = await completeSale({
        idempotencyKey: key,
        lines: lines.map(({ productId, quantity }) => ({ productId, quantity })),
        discountPercent: discount,
        tendered: tenderedNum,
        customerName,
        customerPhone,
      });
    } catch {
      // Connection dropped mid-request. The same key is queued, so if the
      // server did record it the sync simply returns the original receipt.
      if (offlineReady) return queueOffline();
      setError("No connection. Check the internet and try again — this sale has not been recorded.");
      setBusy(false);
      return;
    }
    if (r.ok) {
      setKey(crypto.randomUUID());
      router.push(`/admin/business-os/pos/receipt/${r.receiptNumber}`);
    } else {
      setError(r.error);
      setBusy(false);
    }
  }

  async function registerDevice() {
    const name = window.prompt("Name this till (e.g. Front counter):");
    if (!name) return;
    const r = await registerOfflineTerminal(name);
    if (!r.ok) { setError(r.error); return; }
    await setMeta("terminalId", r.terminalId);
    setTerminalId(r.terminalId);
    setNotice("This device is now the offline terminal. Keep this page open until it says it is ready, then try it with the internet off.");
  }

  const waiting = queue.filter((q) => q.status !== "SYNCED");

  return (
    <div className="space-y-6">
    {savedOffline && (
      <div className="hidden print:block">
        <p className="text-center font-semibold">SWD — Smart Devices &amp; Digital Services</p>
        <p className="text-center">PROVISIONAL RECEIPT {savedOffline.q.provisionalReceipt}</p>
        <p className="text-center text-xs">Recorded on the till while offline. The official receipt number follows once synced.</p>
        <ul className="mt-2">{savedOffline.titles.map((t) => <li key={t}>{t}</li>)}</ul>
        <p className="mt-2">Total: {savedOffline.q.sale.expectedTotal.toLocaleString()} UGX · Cash {savedOffline.q.sale.tendered.toLocaleString()} · Change {savedOffline.change.toLocaleString()}</p>
        <p className="text-xs">{new Date(savedOffline.q.sale.occurredAt).toLocaleString()}</p>
      </div>
    )}
    <div className="space-y-6 print:hidden">
      {offlineEnabled && (
        <div className="rounded-xl border border-border bg-white p-4 text-sm" role="status">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${online ? "bg-light text-slate" : "bg-navy text-white"}`}>{online ? "Online" : "Offline"}</span>
            {offlineReady ? (
              <>
                <span className="text-navy">{waiting.length} sale{waiting.length === 1 ? "" : "s"} waiting to sync</span>
                <button onClick={() => void syncAll()} disabled={!online || syncing || waiting.length === 0} className="rounded-lg bg-light px-3 py-1 text-xs font-medium text-navy hover:bg-border disabled:opacity-40">{syncing ? "Syncing…" : "Sync now"}</button>
                {queue.some((q) => q.status === "SYNCED") && <button onClick={async () => { await clearSynced(); await refreshQueue(); }} className="text-xs text-slate underline">Clear synced</button>}
              </>
            ) : canRegisterTerminal ? (
              <button onClick={registerDevice} className="rounded-lg bg-light px-3 py-1 text-xs font-medium text-navy hover:bg-border">Use this device as the offline terminal</button>
            ) : (
              <span className="text-slate">Offline selling is available on one registered till only. Ask the owner.</span>
            )}
          </div>
          {!online && offlineReady && <p className="mt-2 text-xs text-slate">Cash sales only. Stock shown was current when this page loaded ({new Date(catalogueAt).toLocaleTimeString()}) and may be out of date.</p>}
          {notice && <p className="mt-2 text-xs text-navy">{notice}</p>}
          {queue.length > 0 && (
            <ul className="mt-3 divide-y divide-border text-xs">
              {queue.map((q) => (
                <li key={q.sale.clientId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-medium text-navy">{q.receiptNumber ?? q.provisionalReceipt}</span>
                  <span className="text-slate">{q.sale.expectedTotal.toLocaleString()} UGX · {new Date(q.sale.occurredAt).toLocaleTimeString()}</span>
                  <span className="text-slate">{q.status === "PENDING_SYNC" ? "waiting" : q.status === "SYNCED" ? "recorded" : q.status === "SYNCING" ? "syncing" : "needs a manager"}</span>
                  {q.sale.employeeId !== employeeId && q.status !== "SYNCED" && <span className="text-slate">— made by another employee; they must sign in to sync it</span>}
                  {q.error && q.status !== "SYNCED" && <span className="text-red-600">{q.error}</span>}
                  {q.status === "FAILED" && q.sale.employeeId === employeeId && (
                    <button onClick={async () => { await updateItem(q.sale.clientId, { status: "PENDING_SYNC" }); await refreshQueue(); void syncAll(); }} className="text-blue underline">Retry</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {savedOffline && (
        <div role="status" className="rounded-xl border border-border bg-white p-4 text-sm">
          <p className="font-semibold text-navy">Saved on this till — not yet recorded on the server</p>
          <p className="mt-1 text-slate">Provisional receipt <b>{savedOffline.q.provisionalReceipt}</b> · Total {savedOffline.q.sale.expectedTotal.toLocaleString()} UGX · Change {savedOffline.change.toLocaleString()} UGX</p>
          <p className="mt-1 text-xs text-slate">It will sync automatically when the internet returns. Do not clear the browser data on this device.</p>
          <div className="mt-2 flex gap-3">
            <button onClick={() => window.print()} className="rounded-lg bg-light px-3 py-1.5 text-xs font-medium text-navy hover:bg-border">Print provisional receipt</button>
            <button onClick={() => setSavedOffline(null)} className="rounded-lg bg-blue px-3 py-1.5 text-xs font-medium text-white">Next sale</button>
          </div>
        </div>
      )}
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
    </div>
    </div>
  );
}
