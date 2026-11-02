// Node-runtime session lookup that is checked against the database on every
// call. The signed cookie only proves who someone logged in as; it must NOT be
// the source of truth for what they may do now, otherwise a deactivated
// employee, or one whose role was lowered, keeps their old powers until the
// 8-hour cookie expires. (proxy.ts runs on the Edge without database access and
// only uses the cookie as an outer wall; every page and action comes through here.)
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { admins } from "@/lib/db/schema";
import { ADMIN_COOKIE, verifySessionToken, type SessionPayload } from "@/lib/admin-auth";

export async function sessionFromToken(token: string | undefined | null): Promise<SessionPayload | null> {
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const id = Number(payload.adminId);
  if (!Number.isInteger(id)) return null;
  const [a] = await db.select({ active: admins.active, staffRole: admins.staffRole, email: admins.email }).from(admins).where(eq(admins.id, id)).limit(1);
  if (!a || !a.active) return null;
  return { ...payload, email: a.email, staffRole: a.staffRole };
}

export async function getCurrentStaffSession(): Promise<SessionPayload | null> {
  const { cookies } = await import("next/headers");
  return sessionFromToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function requireAdminSession(req: NextRequest): Promise<SessionPayload | null> {
  return sessionFromToken(req.cookies.get(ADMIN_COOKIE)?.value);
}
