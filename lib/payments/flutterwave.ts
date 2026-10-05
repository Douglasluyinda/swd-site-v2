// Flutterwave implementation of PaymentProvider (Standard/Hosted Checkout).
//
// Required env vars:
//   FLUTTERWAVE_PUBLIC_KEY   — used client-side if inline checkout is added later
//   FLUTTERWAVE_SECRET_KEY   — server-side, used to initiate + verify transactions
//   FLUTTERWAVE_SECRET_HASH  — a string you set in the Flutterwave dashboard
//                              webhook settings; incoming webhooks must echo it
//                              back in the "verif-hash" header
//
// Docs: https://developer.flutterwave.com/docs/collecting-payments/standard

import type {
  InitiatePaymentInput,
  InitiatePaymentResult,
  PaymentProvider,
  VerifyPaymentResult,
} from "./types";

const FLW_BASE = "https://api.flutterwave.com/v3";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in your ` +
        `Vercel project settings before accepting live payments.`,
    );
  }
  return value;
}

export const flutterwave: PaymentProvider = {
  name: "flutterwave",

  async initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult> {
    const secretKey = requireEnv("FLUTTERWAVE_SECRET_KEY");

    const res = await fetch(`${FLW_BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: input.txRef,
        amount: input.amount,
        currency: input.currency,
        redirect_url: input.redirectUrl,
        customer: {
          email: input.customerEmail,
          name: input.customerName,
          phonenumber: input.customerPhone,
        },
        customizations: {
          title: "SWD — Smart Devices & Digital Services",
          description: "Order payment",
        },
        meta: input.meta,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Flutterwave initiate failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const checkoutUrl = data?.data?.link;
    if (!checkoutUrl) {
      throw new Error("Flutterwave initiate: no checkout link returned");
    }

    return { checkoutUrl };
  },

  async verify(providerTxId: string): Promise<VerifyPaymentResult> {
    const secretKey = requireEnv("FLUTTERWAVE_SECRET_KEY");

    const res = await fetch(
      `${FLW_BASE}/transactions/${encodeURIComponent(providerTxId)}/verify`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Flutterwave verify failed (${res.status}): ${body}`);
    }

    const data = await res.json();
    const tx = data?.data;

    return {
      success: data?.status === "success" && tx?.status === "successful",
      providerTxId: String(tx?.id ?? providerTxId),
      status: tx?.status ?? "unknown",
      amount: tx?.amount ?? 0,
      currency: tx?.currency ?? "USD",
      txRef: tx?.tx_ref ?? "",
      feeAmount: tx?.app_fee,
      raw: data,
    };
  },

  verifyWebhookSignature(headerSignature: string | null): boolean {
    const expected = process.env.FLUTTERWAVE_SECRET_HASH;
    if (!expected || !headerSignature) return false;
    // Flutterwave sends this back verbatim as the "verif-hash" header —
    // a constant-time compare avoids timing side-channels.
    if (headerSignature.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= headerSignature.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
  },
};
