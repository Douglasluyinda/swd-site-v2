// Email channel via Resend (https://resend.com — simple API, generous
// free tier, easy to swap for SendGrid/Postmark/etc. by rewriting this
// one file since NotificationChannel is the contract everything else
// depends on).
//
// If RESEND_API_KEY isn't set, this channel reports itself as
// unconfigured and dispatch() skips it — checkout and order-status
// changes never fail because notifications aren't wired up yet.

import type { NotificationChannel, NotificationInput } from "./types";

export const emailChannel: NotificationChannel = {
  name: "email",

  isConfigured() {
    return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  },

  async send(input: NotificationInput) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) return;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!res.ok) {
      // Notification failures should never break the order flow that
      // triggered them — log and move on.
      console.error(`Email notification failed (${res.status}):`, await res.text());
    }
  },
};
