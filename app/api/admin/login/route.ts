import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, checkAdminCredentials, createSessionToken } from "@/lib/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json(
      { error: "Admin auth is not configured. Set ADMIN_SESSION_SECRET." },
      { status: 500 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rate = await checkRateLimit(`admin-login:${ip}`, 10, 15 * 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const admin = await checkAdminCredentials(email, password);
  if (!admin) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = await createSessionToken(admin);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
