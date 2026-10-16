// Shared Twilio REST client used by both the SMS and WhatsApp channels
// (same Twilio account, different "From" number). Plain fetch against
// Twilio's Messages API rather than the Twilio SDK, to match the rest of
// this codebase's dependency-light style (see lib/payments/flutterwave.ts,
// lib/notifications/email.ts).

export async function sendTwilioMessage(opts: {
  to: string;
  from: string;
  body: string;
}): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return;

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: opts.to, From: opts.from, Body: opts.body }),
    },
  );

  if (!res.ok) {
    // Notification failures should never break the order flow that
    // triggered them — log and move on.
    console.error(`Twilio message failed (${res.status}):`, await res.text());
  }
}
