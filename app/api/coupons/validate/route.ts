import { NextRequest, NextResponse } from "next/server";
import { computeDiscount, getValidCoupon } from "@/lib/coupons";

export async function POST(req: NextRequest) {
  const { code, subtotal } = await req.json();

  if (!code || typeof subtotal !== "number") {
    return NextResponse.json({ valid: false, error: "Missing code or subtotal" }, { status: 400 });
  }

  const coupon = await getValidCoupon(code);
  if (!coupon) {
    return NextResponse.json({ valid: false, error: "Invalid or expired coupon code" });
  }

  const discount = computeDiscount(coupon, subtotal);
  return NextResponse.json({ valid: true, discount, code: coupon.code });
}
