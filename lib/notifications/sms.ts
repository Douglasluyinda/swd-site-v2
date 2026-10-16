// SMS channel via Twilio. No-ops (like every other channel here) when the
// required env vars aren't set, and when an order has no phone number.
//
// Required env vars:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_SMS_FROM — a Twilio phone number in E.164 format (e.g. +15551234567)

import type { NotificationChannel, NotificationInput } from "./types";
import { sendTwilioMessage } from "./twilio-client";

export const smsChannel: NotificationChannel = {
  name: "sms",

  isConfigured() {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM,
    );
  },

  async send(input: NotificationInput) {
    const from = process.env.TWILIO_SMS_FROM;
    if (!from || !input.toPhone) return;

    await sendTwilioMessage({
      to: input.toPhone,
      from,
      body: `${input.subject}\n\n${input.text}`,
    });
  },
};
