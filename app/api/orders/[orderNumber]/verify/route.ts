// POST /api/orders/[orderNumber]/verify
// Called from the order confirmation page when the customer lands back
// from Flutterwave's hosted checkout with a transaction_id in the URL.
// This does a real server-side verification call (not just "the redirect
// happened, so mark it paid") — it's a convenience so the customer sees
// PAID immediately rather than waiting for the async webhook, but the
// webhook remains the authoritative path if this call is skipped or fails.

import { NextRequest, NextResponse } from "next/server";
import { applyVerifiedPayment } from "@/lib/payments/apply-verified-payment";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  await params;
  const { transactionId } = await req.json();
  if (!transactionId) {
    return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
  }

  try {
    const result = await applyVerifiedPayment(transactionId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Verification failed" },
      { status: 502 },
    );
  }
}
