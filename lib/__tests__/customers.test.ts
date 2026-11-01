import { describe, expect, it } from "vitest";
import { normalizePhone, validateCustomer, validateNote } from "@/lib/customers";

describe("normalizePhone", () => {
  it("normalises common Ugandan formats to the same E.164 value", () => {
    for (const v of ["0772123456", "0772 123 456", "+256772123456", "256772123456", "00256772123456", "772123456", "(0772)-123-456"]) {
      expect(normalizePhone(v)).toBe("+256772123456");
    }
  });
  it("keeps other international numbers", () => expect(normalizePhone("+254712345678")).toBe("+254712345678"));
  it("rejects junk", () => {
    for (const v of ["", null, undefined, "abc", "123", "07721234", "+25677", "0772 12x456"]) {
      expect(normalizePhone(v as string)).toBeNull();
    }
  });
});

describe("validateCustomer", () => {
  it("needs name and phone but not email (walk-ins)", () => {
    expect(validateCustomer({ name: "Amina", phone: "0772123456" })).toBeNull();
    expect(validateCustomer({ name: " ", phone: "0772123456" })).toMatch(/Name/);
    expect(validateCustomer({ name: "A", phone: "12" })).toMatch(/phone/);
    expect(validateCustomer({ name: "A", phone: "0772123456", email: "nope" })).toMatch(/email/);
    expect(validateCustomer({ name: "A", phone: "0772123456", email: "a@b.co" })).toBeNull();
  });
});

describe("validateNote", () => {
  it("checks kind, text and length", () => {
    expect(validateNote({ kind: "COMPLAINT", text: "late delivery" })).toBeNull();
    expect(validateNote({ kind: "OTHER", text: "x" })).toMatch(/type/);
    expect(validateNote({ kind: "NOTE", text: "  " })).toMatch(/something/);
    expect(validateNote({ kind: "NOTE", text: "x".repeat(2001) })).toMatch(/2,000/);
  });
});
