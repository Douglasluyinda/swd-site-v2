import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { flutterwave } from "@/lib/payments/flutterwave";

describe("flutterwave.verifyWebhookSignature", () => {
  const originalHash = process.env.FLUTTERWAVE_SECRET_HASH;

  beforeEach(() => {
    process.env.FLUTTERWAVE_SECRET_HASH = "test-secret-hash-value";
  });

  afterEach(() => {
    process.env.FLUTTERWAVE_SECRET_HASH = originalHash;
  });

  it("accepts a header matching the configured secret hash", () => {
    expect(flutterwave.verifyWebhookSignature("test-secret-hash-value")).toBe(true);
  });

  it("rejects a wrong header value", () => {
    expect(flutterwave.verifyWebhookSignature("wrong-value")).toBe(false);
  });

  it("rejects a null header", () => {
    expect(flutterwave.verifyWebhookSignature(null)).toBe(false);
  });

  it("rejects when no secret hash is configured at all", () => {
    delete process.env.FLUTTERWAVE_SECRET_HASH;
    expect(flutterwave.verifyWebhookSignature("anything")).toBe(false);
  });

  it("rejects a header that merely starts with the correct value (length check)", () => {
    expect(flutterwave.verifyWebhookSignature("test-secret-hash-valueEXTRA")).toBe(false);
  });
});
