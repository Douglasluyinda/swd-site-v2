// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { enqueue, getMeta, listQueue, recoverInterrupted, setMeta, unsyncedCount, updateItem } from "@/lib/offline-queue";
import type { OfflineSale } from "@/lib/offline";

const sale = (id: string, at: string): OfflineSale => ({ clientId: id, terminalId: "t", employeeId: 1, occurredAt: at, lines: [{ productId: 1, quantity: 1 }], discountPercent: 0, expectedTotal: 1000, tendered: 1000 });

beforeEach(() => { (globalThis as { indexedDB: IDBFactory }).indexedDB = new IDBFactory(); });

describe("offline queue (IndexedDB)", () => {
  it("a queued sale is durable and visible, oldest first", async () => {
    await enqueue(sale("bbbbbbbb-0000-0000-0000-000000000002", "2026-11-02T09:00:00Z"));
    await enqueue(sale("aaaaaaaa-0000-0000-0000-000000000001", "2026-11-02T08:00:00Z"));
    const q = await listQueue();
    expect(q.map((i) => i.sale.clientId[0])).toEqual(["a", "b"]);
    expect(q[0].status).toBe("PENDING_SYNC");
    expect(q[0].provisionalReceipt).toMatch(/^PENDING-/);
    expect(await unsyncedCount()).toBe(2);
  });
  it("cannot overwrite a sale that is already queued", async () => {
    await enqueue(sale("aaaaaaaa-0000-0000-0000-000000000001", "2026-11-02T08:00:00Z"));
    await expect(enqueue(sale("aaaaaaaa-0000-0000-0000-000000000001", "2026-11-02T08:00:00Z"))).rejects.toBeTruthy();
    expect(await listQueue()).toHaveLength(1);
  });
  it("status moves only on request; failed sales stay recoverable with their reason", async () => {
    const id = "aaaaaaaa-0000-0000-0000-000000000001";
    await enqueue(sale(id, "2026-11-02T08:00:00Z"));
    await updateItem(id, { status: "FAILED", error: "This would take stock below zero.", attempts: 1 });
    const [q] = await listQueue();
    expect(q.status).toBe("FAILED");
    expect(q.error).toMatch(/below zero/);
    expect(q.sale.expectedTotal).toBe(1000); // original record intact
    await updateItem(id, { status: "SYNCED", receiptNumber: "SWD-R-2026-000001" });
    expect(await unsyncedCount()).toBe(0);
  });
  it("a sale left SYNCING when the tab died goes back to pending", async () => {
    const id = "aaaaaaaa-0000-0000-0000-000000000001";
    await enqueue(sale(id, "2026-11-02T08:00:00Z"));
    await updateItem(id, { status: "SYNCING" });
    expect(await recoverInterrupted()).toBe(1);
    expect((await listQueue())[0].status).toBe("PENDING_SYNC");
  });
  it("meta (terminal id, catalogue time) round-trips", async () => {
    await setMeta("terminalId", "abc");
    expect(await getMeta<string>("terminalId")).toBe("abc");
    expect(await getMeta("missing")).toBeUndefined();
  });
});
