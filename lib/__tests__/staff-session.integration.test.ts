// Needs a real Postgres via DATABASE_URL (non-production — inserts rows).
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins } from "@/lib/db/schema";
import { createSessionToken } from "@/lib/admin-auth";
import { sessionFromToken } from "@/lib/staff-session";

describe("sessions follow the database, not the cookie", () => {
  it("a deactivated employee's still-valid cookie stops working immediately", async () => {
    const [a] = await db.insert(admins).values({ email: `ss-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`, passwordHash: "x", staffRole: "MANAGER" }).returning();
    const token = await createSessionToken({ id: String(a.id), email: a.email, staffRole: "MANAGER" });
    expect((await sessionFromToken(token))?.staffRole).toBe("MANAGER");
    await db.update(admins).set({ active: false }).where(eq(admins.id, a.id));
    expect(await sessionFromToken(token)).toBeNull();
  });

  it("a demoted employee gets their new role at once, even though the cookie says otherwise", async () => {
    const [a] = await db.insert(admins).values({ email: `ss2-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`, passwordHash: "x", staffRole: "OWNER" }).returning();
    const token = await createSessionToken({ id: String(a.id), email: a.email, staffRole: "OWNER" });
    await db.update(admins).set({ staffRole: "CASHIER" }).where(eq(admins.id, a.id));
    expect((await sessionFromToken(token))?.staffRole).toBe("CASHIER");
  });

  it("rejects tampered, expired-style and unknown-user tokens", async () => {
    expect(await sessionFromToken("garbage")).toBeNull();
    expect(await sessionFromToken(undefined)).toBeNull();
    const ghost = await createSessionToken({ id: "999999999", email: "ghost@test.local", staffRole: "OWNER" });
    expect(await sessionFromToken(ghost)).toBeNull();
  });
});
