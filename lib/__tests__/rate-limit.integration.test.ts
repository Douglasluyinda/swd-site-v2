// Integration test against a real Postgres database.

import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit, then blocks", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await checkRateLimit(key, 3, 60));
    }
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false, false]);
  });

  it("keeps separate counters per key", async () => {
    const keyA = `test:${crypto.randomUUID()}`;
    const keyB = `test:${crypto.randomUUID()}`;
    await checkRateLimit(keyA, 1, 60);
    const secondOnA = await checkRateLimit(keyA, 1, 60);
    const firstOnB = await checkRateLimit(keyB, 1, 60);
    expect(secondOnA.allowed).toBe(false);
    expect(firstOnB.allowed).toBe(true);
  });

  it("does not allow more than the limit under concurrent requests", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 20 }, () => checkRateLimit(key, 5, 60)));
    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(5);
  });
});
