import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyDsersWebhookSignature, mapDsersStatus } from "@/lib/dsers";

describe("verifyDsersWebhookSignature", () => {
  const originalSecret = process.env.DSERS_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.DSERS_WEBHOOK_SECRET = "test-dsers-webhook-secret";
  });

  afterEach(() => {
    process.env.DSERS_WEBHOOK_SECRET = originalSecret;
  });

  it("accepts a header matching the configured secret", () => {
    expect(verifyDsersWebhookSignature("test-dsers-webhook-secret")).toBe(true);
  });

  it("rejects a wrong header value", () => {
    expect(verifyDsersWebhookSignature("wrong-value")).toBe(false);
  });

  it("rejects a null header", () => {
    expect(verifyDsersWebhookSignature(null)).toBe(false);
  });

  it("rejects when no secret is configured at all", () => {
    delete process.env.DSERS_WEBHOOK_SECRET;
    expect(verifyDsersWebhookSignature("anything")).toBe(false);
  });

  it("rejects a header that merely starts with the correct value (length check)", () => {
    expect(verifyDsersWebhookSignature("test-dsers-webhook-secretEXTRA")).toBe(false);
  });
});

describe("mapDsersStatus", () => {
  it("maps shipped to SHIPPED / confirmed", () => {
    expect(mapDsersStatus("shipped")).toEqual({ fulfillmentStatus: "confirmed", orderStatus: "SHIPPED" });
  });

  it("maps delivered to DELIVERED / confirmed", () => {
    expect(mapDsersStatus("delivered")).toEqual({ fulfillmentStatus: "confirmed", orderStatus: "DELIVERED" });
  });

  it("maps cancelled to CANCELLED / failed", () => {
    expect(mapDsersStatus("cancelled")).toEqual({ fulfillmentStatus: "failed", orderStatus: "CANCELLED" });
  });

  it("defaults unknown statuses to SHIPPED / confirmed", () => {
    expect(mapDsersStatus(undefined)).toEqual({ fulfillmentStatus: "confirmed", orderStatus: "SHIPPED" });
  });
});
