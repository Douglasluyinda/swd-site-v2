// POST /api/webhooks/flutterwave
// Flutterwave calls this after a transaction completes. We verify the
// "verif-hash" header against FLUTTERWAVE_SECRET_HASH, then re-verify the
// transaction directly against Flutterwave's API (never trust the webhook
// payload's amount/status alone) before marking anything PAID.

import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/payments";
import { applyVerifiedPayment } from "@/lib/payments/apply-verified-payment";

export async function POST(req: NextRequest) {
  const provider = getPaymentProvider("flutterwave");
  const signature = req.headers.get("verif-hash");

  if (!provider.verifyWebhookSignature(signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = await req.json();
  const providerTxId = payload?.data?.id?.toString();
  if (!providerTxId) {
    return NextResponse.json({ error: "Missing transaction id" }, { status: 400 });
  }

  const result = await applyVerifiedPayment(providerTxId);
  return NextResponse.json({ received: true, ...result });
}
