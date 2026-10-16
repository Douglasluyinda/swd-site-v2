import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { emailChannel } from "@/lib/notifications/email";
import { smsChannel } from "@/lib/notifications/sms";
import { whatsappChannel } from "@/lib/notifications/whatsapp";

const envKeys = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_SMS_FROM",
  "TWILIO_WHATSAPP_FROM",
] as const;

describe("notification channels: isConfigured()", () => {
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });

  it("email channel is unconfigured with no env vars", () => {
    expect(emailChannel.isConfigured()).toBe(false);
  });

  it("email channel is configured once both vars are set", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "SWD <orders@swd.example>";
    expect(emailChannel.isConfigured()).toBe(true);
  });

  it("sms channel requires all three Twilio vars", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    expect(smsChannel.isConfigured()).toBe(false);
    process.env.TWILIO_SMS_FROM = "+15551234567";
    expect(smsChannel.isConfigured()).toBe(true);
  });

  it("whatsapp channel requires its own From number, independent of SMS", () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_SMS_FROM = "+15551234567";
    expect(whatsappChannel.isConfigured()).toBe(false);
    process.env.TWILIO_WHATSAPP_FROM = "whatsapp:+14155238886";
    expect(whatsappChannel.isConfigured()).toBe(true);
  });

  it("sms channel send() is a no-op without a recipient phone number", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_SMS_FROM = "+15551234567";
    await expect(
      smsChannel.send({ to: "customer@example.com", subject: "Hi", text: "Hi" }),
    ).resolves.toBeUndefined();
  });
});
