import { db } from "./db/client";
import { coupons } from "./db/schema";
import { eq } from "drizzle-orm";

export type Coupon = typeof coupons.$inferSelect;

export function computeDiscount(coupon: Pick<Coupon, "percentOff" | "amountOff">, subtotal: number): number {
  if (coupon.percentOff) return round2((subtotal * coupon.percentOff) / 100);
  if (coupon.amountOff) return round2(Math.min(coupon.amountOff, subtotal));
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getValidCoupon(code: string): Promise<Coupon | null> {
  if (!code) return null;
  const [coupon] = await db
    .select()
    .from(coupons)
    .where(eq(coupons.code, code.trim().toUpperCase()))
    .limit(1);

  if (!coupon || !coupon.active) return null;
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) return null;
  return coupon;
}
