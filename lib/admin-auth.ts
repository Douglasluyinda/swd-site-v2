// Multi-admin session auth.
//
// Each admin has their own row in `admins` (email + bcrypt password
// hash). A session is a signed, expiring token — base64url(payload) +
// HMAC-SHA256 signature, using the Web Crypto API so it works in both
// the Node.js and Edge runtimes (proxy.ts / middleware runs on Edge).
// This is a small hand-rolled JWT-equivalent rather than a full JWT
// library, kept intentionally minimal; if you later need refresh
// tokens, revocation lists, or SSO, swap this for NextAuth/Clerk —
// the `admins` table and bcrypt hashing underneath would carry over.

import { db } from "./db/client";
import { admins } from "./db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const ADMIN_COOKIE = "swd_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

type SessionPayload = {
  adminId: string;
  email: string;
  exp: number; // unix seconds
};

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(str.length / 4) * 4, "=");
  return new Uint8Array(Buffer.from(padded, "base64"));
}

async function hmacSign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64url(new Uint8Array(sig));
}

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function createSessionToken(admin: { id: string; email: string }): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET");

  const payload: SessionPayload = {
    adminId: admin.id,
    email: admin.email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmacSign(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || !token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expected = await hmacSign(secret, encodedPayload);
  if (!timingSafeStringEqual(signature, expected)) return null;

  try {
    const payload: SessionPayload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(encodedPayload)),
    );
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function isValidSessionToken(token: string | undefined | null): Promise<boolean> {
  return (await verifySessionToken(token)) !== null;
}

// Node-runtime only (bcrypt) — used from the login route and server
// actions, never from proxy.ts (Edge).
export async function checkAdminCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string } | null> {
  const [admin] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (!admin) {
    // Still run a hash comparison against a dummy value so the response
    // time doesn't reveal whether the email exists.
    await bcrypt.compare(password, "$2a$10$invalidsaltinvalidsaltinvalidsalu");
    return null;
  }
  const ok = await bcrypt.compare(password, admin.passwordHash);
  return ok ? { id: admin.id, email: admin.email, name: admin.name } : null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
