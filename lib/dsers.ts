// DSers Open API integration — order sync (push) and webhook (pull).
//
// Required env vars:
//   DSERS_API_URL          — base URL for the DSers Open API (e.g.
//                             https://openapi.dsers.com)
//   DSERS_API_KEY           — server-side API key/token, sent as a Bearer
//                             token. Never exposed to the browser.
//   DSERS_WEBHOOK_SECRET    — shared secret configured in the DSers
//                             dashboard; incoming webhooks must echo it back
//                             in the "x-dsers-webhook-secret" header.
//
// The request/response shapes below (endpoint path, field names, webhook
// header and payload) are a reasonable default following DSers' documented
// conventions and the shared-secret pattern already used for the
// Flutterwave webhook in this codebase. Confirm them against your DSers
// Open API credentials/docs (they differ by partner tier) before relying on
// this in production, and adjust requestBody()/mapDsersStatus() to match.
//
// Merchant-of-record boundary: this module only exchanges fulfillment data
// (order + shipping details out, tracking/status in). It must never be
// used to route customer payment to the supplier — SWD pays/manages DSers
// as its own separate, SWD-controlled fulfillment operation, independent
// of the Flutterwave customer-payment flow.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it before syncing orders to DSers.`,
    );
  }
  return value;
}

export type DsersOrderItem = {
  dsersProductId: string;
  dsersVariantId?: string;
  dsersSku?: string;
  quantity: number;
};

export type DsersOrderPayload = {
  orderNumber: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    email: string;
    country: string;
    city: string;
    address: string;
    deliveryInstructions?: string;
  };
  items: DsersOrderItem[];
};

export type DsersSyncResult = {
  success: boolean;
  dsersOrderId?: string;
  raw: unknown;
};

export async function sendOrderToDsers(payload: DsersOrderPayload): Promise<DsersSyncResult> {
  const apiUrl = requireEnv("DSERS_API_URL");
  const apiKey = requireEnv("DSERS_API_KEY");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_number: payload.orderNumber,
      shipping_address: {
        name: payload.shippingAddress.fullName,
        phone: payload.shippingAddress.phone,
        email: payload.shippingAddress.email,
        country: payload.shippingAddress.country,
        city: payload.shippingAddress.city,
        address1: payload.shippingAddress.address,
        note: payload.shippingAddress.deliveryInstructions,
      },
      items: payload.items.map((item) => ({
        product_id: item.dsersProductId,
        variant_id: item.dsersVariantId,
        sku: item.dsersSku,
        quantity: item.quantity,
      })),
    }),
  });

  const raw = await res.json().catch(() => null);

  if (!res.ok) {
    return { success: false, raw };
  }

  const dsersOrderId =
    (raw as { data?: { order_id?: string | number }; order_id?: string | number; id?: string | number } | null)
      ?.data?.order_id ??
    (raw as { order_id?: string | number } | null)?.order_id ??
    (raw as { id?: string | number } | null)?.id;

  return {
    success: true,
    dsersOrderId: dsersOrderId !== undefined ? String(dsersOrderId) : undefined,
    raw,
  };
}

// Constant-time compare against DSERS_WEBHOOK_SECRET, mirroring the
// verif-hash check in lib/payments/flutterwave.ts.
export function verifyDsersWebhookSignature(headerSignature: string | null): boolean {
  const expected = process.env.DSERS_WEBHOOK_SECRET;
  if (!expected || !headerSignature) return false;
  if (headerSignature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= headerSignature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

// Maps a DSers fulfillment status string to our internal fulfillments.status
// and order lifecycle status. Extend the switch once DSers' real webhook
// status vocabulary is confirmed against their docs.
export function mapDsersStatus(dsersStatus: string | undefined): {
  fulfillmentStatus: "pending" | "sent" | "confirmed" | "failed";
  orderStatus: string;
} {
  switch ((dsersStatus ?? "").toLowerCase()) {
    case "cancelled":
    case "canceled":
      return { fulfillmentStatus: "failed", orderStatus: "CANCELLED" };
    case "delivered":
      return { fulfillmentStatus: "confirmed", orderStatus: "DELIVERED" };
    case "in_transit":
    case "shipped":
    default:
      return { fulfillmentStatus: "confirmed", orderStatus: "SHIPPED" };
  }
}
