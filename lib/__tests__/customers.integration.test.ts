// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins, customerNotes, customers, products, sales } from "@/lib/db/schema";
import { addCustomerNote, findOrCreateByPhone, updateCustomer } from "@/lib/customer-service";
import { applyStockMovement } from "@/lib/inventory";
import { openSession } from "@/lib/cash-sessions";
import { createSale } from "@/lib/sales";

const tag = () => `${Date.now()}${Math.floor(Math.random() * 1e5)}`;
const phone = () => `07${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

describe("customers (integration)", () => {
  it("registers a walk-in by phone alone and finds them again in any format", async () => {
    const p = phone();
    const a = await findOrCreateByPhone(db, { name: "Amina", phone: p });
    expect(a.email).toBeNull();
    const b = await findOrCreateByPhone(db, { name: "Someone else", phone: "+256" + p.slice(1) });
    expect(b.id).toBe(a.id);
  });

  it("concurrent registration of the same phone yields one customer", async () => {
    const p = phone();
    const rs = await Promise.all(Array.from({ length: 6 }, () => findOrCreateByPhone(db, { name: "Racer", phone: p })));
    expect(new Set(rs.map((r) => r.id)).size).toBe(1);
  });

  it("rejects bad phone/name and refuses a phone already used when editing", async () => {
    await expect(findOrCreateByPhone(db, { name: "X", phone: "123" })).rejects.toThrow(/valid phone/);
    const a = await findOrCreateByPhone(db, { name: "A", phone: phone() });
    const b = await findOrCreateByPhone(db, { name: "B", phone: phone() });
    await expect(updateCustomer(b.id, { name: "B", phone: a.phone!, marketingOptIn: false })).rejects.toThrow(/already uses/);
  });

  it("stores notes/complaints attributed to the employee", async () => {
    const [e] = await db.insert(admins).values({ email: `cn-${tag()}@t.local`, passwordHash: "x" }).returning();
    const c = await findOrCreateByPhone(db, { name: "N", phone: phone() });
    await addCustomerNote({ customerId: c.id, kind: "COMPLAINT", text: "Charger stopped working", employeeId: e.id });
    await expect(addCustomerNote({ customerId: c.id, kind: "NOPE", text: "x", employeeId: e.id })).rejects.toThrow(/type/);
    const rows = await db.select().from(customerNotes).where(eq(customerNotes.customerId, c.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].employeeId).toBe(e.id);
  });

  it("a POS sale with a phone links to (and registers) the customer; bad phone fails cleanly", async () => {
    const t = tag();
    const [e] = await db.insert(admins).values({ email: `cs-${t}@t.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
    const [p] = await db.insert(products).values({ sku: `CS-${t}`, title: "CRM item", status: "active", sellingPrice: 10000 }).returning();
    await openSession(e.id, 0);
    await applyStockMovement({ productId: p.id, type: "PURCHASE_RECEIPT", quantity: 5, employeeId: e.id });
    const ph = phone();
    const base = { employeeId: e.id, role: "OWNER", lines: [{ productId: p.id, quantity: 1 }], discountPercent: 0, tendered: 10000 };

    await expect(createSale({ ...base, idempotencyKey: `k-bad-${t}`, customerPhone: "12" })).rejects.toThrow(/valid phone/);
    const r1 = await createSale({ ...base, idempotencyKey: `k1-${t}`, customerName: "Zed", customerPhone: ph });
    const r2 = await createSale({ ...base, idempotencyKey: `k2-${t}`, customerPhone: "+256" + ph.slice(1) });
    const rows = await db.select().from(sales).where(eq(sales.employeeId, e.id));
    const ids = new Set(rows.filter((s) => [r1.receiptNumber, r2.receiptNumber].includes(s.receiptNumber)).map((s) => s.customerId));
    expect(ids.size).toBe(1);
    expect([...ids][0]).not.toBeNull();
    const [cust] = await db.select().from(customers).where(eq(customers.id, [...ids][0]!));
    expect(cust.fullName).toBe("Zed");

    // anonymous walk-in stays unlinked
    const r3 = await createSale({ ...base, idempotencyKey: `k3-${t}` });
    const [s3] = await db.select().from(sales).where(eq(sales.receiptNumber, r3.receiptNumber));
    expect(s3.customerId).toBeNull();
  });
});
