// Payment provider abstraction. Every gateway (Flutterwave first,
// others later) implements this interface so checkout and webhook
// code never depend on a specific provider's SDK shape.

export type InitiatePaymentInput = {
  txRef: string; // our unique reference, stored on the Payment row
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  redirectUrl: string; // where the gateway sends the browser back to
  meta?: Record<string, string>;
};

export type InitiatePaymentResult = {
  checkoutUrl: string; // hosted payment page to redirect the customer to
};

export type VerifyPaymentResult = {
  success: boolean;
  providerTxId: string;
  status: string; // provider's raw status string
  amount: number;
  currency: string;
  txRef: string;
  feeAmount?: number;
  raw: unknown; // full provider payload, stored for audit
};

export interface PaymentProvider {
  name: string;
  initiate(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verify(providerTxId: string): Promise<VerifyPaymentResult>;
  verifyWebhookSignature(headerSignature: string | null): boolean;
}
