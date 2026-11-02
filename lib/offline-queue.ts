// Browser-only durable queue for offline cash sales (IndexedDB).
// A sale is written here BEFORE the till tells the cashier it is saved, and is
// only marked SYNCED after the server acknowledged it. Nothing sensitive is
// stored: no passwords, no session token, no payment secrets — cash sales only.
import { provisionalReceipt, syncOrder, type OfflineSale, type OfflineStatus } from "@/lib/offline";

export type QueuedSale = {
  sale: OfflineSale;
  status: OfflineStatus;
  provisionalReceipt: string;
  attempts: number;
  error?: string;
  receiptNumber?: string; // authoritative, set once synced
};

const DB_NAME = "swd-pos";
const PENDING = "pending";
const META = "meta";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING, { keyPath: "sale.clientId" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    if (r) r.onerror = () => { db.close(); reject(r.error ?? new Error("IndexedDB request failed")); };
    // Resolve on transaction completion, i.e. after the data is durably committed.
    t.oncomplete = () => { db.close(); resolve(r ? (r.result as T) : undefined); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}

export async function enqueue(sale: OfflineSale): Promise<QueuedSale> {
  const item: QueuedSale = { sale, status: "PENDING_SYNC", provisionalReceipt: provisionalReceipt(sale.clientId), attempts: 0 };
  await tx(PENDING, "readwrite", (s) => s.add(item)); // add: never overwrites an existing sale
  return item;
}

export async function listQueue(): Promise<QueuedSale[]> {
  const all = ((await tx(PENDING, "readonly", (s) => s.getAll())) ?? []) as QueuedSale[];
  return syncOrder(all.map((q) => ({ ...q, occurredAt: q.sale.occurredAt }))).map(({ occurredAt, ...q }) => { void occurredAt; return q as QueuedSale; });
}

export async function updateItem(clientId: string, patch: Partial<Omit<QueuedSale, "sale">>): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction(PENDING, "readwrite");
    const store = t.objectStore(PENDING);
    const get = store.get(clientId);
    get.onsuccess = () => { if (get.result) store.put({ ...get.result, ...patch }); };
    t.oncomplete = () => { db.close(); resolve(); };
    t.onerror = t.onabort = () => { db.close(); reject(t.error); };
  });
}

// Anything stuck in SYNCING (tab closed mid-sync) goes back to pending: the
// server's idempotency makes re-sending safe.
export async function recoverInterrupted(): Promise<number> {
  const q = await listQueue();
  const stuck = q.filter((i) => i.status === "SYNCING");
  for (const i of stuck) await updateItem(i.sale.clientId, { status: "PENDING_SYNC" });
  return stuck.length;
}

export const unsyncedCount = async () => (await listQueue()).filter((q) => q.status !== "SYNCED").length;

export async function setMeta(key: string, value: unknown): Promise<void> {
  await tx(META, "readwrite", (s) => s.put({ key, value }));
}
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const r = (await tx(META, "readonly", (s) => s.get(key))) as { value: T } | undefined;
  return r?.value;
}

export async function clearSynced(): Promise<void> {
  for (const q of await listQueue()) if (q.status === "SYNCED") await tx(PENDING, "readwrite", (st) => st.delete(q.sale.clientId));
}
