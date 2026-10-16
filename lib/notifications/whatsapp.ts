// WhatsApp channel via Twilio's WhatsApp Business API. Same Twilio
// account as SMS, different sender number — Twilio requires the
// "whatsapp:" prefix on both the From and To numbers for this API.
// No-ops when unconfigured or when an order has no phone number.
//
// Required env vars:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM — a WhatsApp-enabled Twilio number, e.g.
//     "whatsapp:+14155238886" (Twilio's sandbox number for testing)

import type { NotificationChannel, NotificationInput } from "./types";
import { sendTwilioMessage } from "./twilio-client";

function toWhatsAppAddress(e164Number: string): string {
  return e164Number.startsWith("whatsapp:") ? e164Number : `whatsapp:${e164Number}`;
}

export const whatsappChannel: NotificationChannel = {
  name: "whatsapp",

  isConfigured() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM,
    );
  },

  async send(input: NotificationInput) {
    const from = process.env.TWILIO_WHATSAPP_FROM;
    if (!from || !input.toPhone) return;

    await sendTwilioMessage({
      to: toWhatsAppAddress(input.toPhone),
      from: toWhatsAppAddress(from),
      body: `${input.subject}\n\n${input.text}`,
    });
  },
};
