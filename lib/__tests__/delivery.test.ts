import { describe, it, expect } from "vitest";
import { matchDeliveryRate } from "@/lib/delivery";

const rates = [
  { region: "Entebbe", cost: 5, estimatedDays: "1-2" },
  { region: "Uganda", cost: 12, estimatedDays: "3-5" },
];

describe("matchDeliveryRate", () => {
  it("matches a region against the city, case-insensitively", () => {
    expect(matchDeliveryRate(rates, "entebbe", "Uganda")).toEqual(rates[0]);
  });

  it("falls back to matching the country when no city matches", () => {
    expect(matchDeliveryRate(rates, "Kampala", "Uganda")).toEqual(rates[1]);
  });

  it("returns null when nothing matches", () => {
    expect(matchDeliveryRate(rates, "Nairobi", "Kenya")).toBeNull();
  });

  it("returns null when no rates are configured", () => {
    expect(matchDeliveryRate([], "Entebbe", "Uganda")).toBeNull();
  });

  it("returns null when city/country are both undefined", () => {
    expect(matchDeliveryRate(rates, undefined, undefined)).toBeNull();
  });

  it("prefers the city match over the country match even if country is listed first", () => {
    const reordered = [rates[1], rates[0]];
    expect(matchDeliveryRate(reordered, "Entebbe", "Uganda")).toEqual(rates[0]);
  });
});
