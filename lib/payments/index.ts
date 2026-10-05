// Provider registry. Checkout/webhook code asks for a provider by name
// rather than importing a specific gateway directly, so adding a second
// gateway later is additive.

import { flutterwave } from "./flutterwave";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = {
  flutterwave,
};

export function getPaymentProvider(name: string = "flutterwave"): PaymentProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown payment provider: ${name}`);
  return provider;
}

export * from "./types";
