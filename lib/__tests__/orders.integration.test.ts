// Integration test — hits a real Postgres database (DATABASE_URL).
// Verifies the property that matters most: concurrent checkouts never
// get the same order number, and numbers are strictly increasing.

import { describe, it, expect } from "vitest";
import { nextOrderNumber } from "@/lib/orders";

describe("nextOrderNumber", () => {
  it("matches the SWD-<year>-<6 digits> format", async () => {
    const num = await nextOrderNumber();
    expect(num).toMatch(/^SWD-\d{4}-\d{6}$/);
  });

  it("never issues the same number twice under concurrent calls", async () => {
    const results = await Promise.all(Array.from({ length: 25 }, () => nextOrderNumber()));
    const unique = new Set(results);
    expect(unique.size).toBe(results.length);
  });

  it("issues strictly increasing sequence numbers within a run", async () => {
    const a = await nextOrderNumber();
    const b = await nextOrderNumber();
    const seqOf = (n: string) => parseInt(n.split("-")[2], 10);
    expect(seqOf(b)).toBeGreaterThan(seqOf(a));
  });
});
