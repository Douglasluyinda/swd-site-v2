// Regression net: every Business OS page and route handler must look up the
// caller's session (database-checked) and check a permission itself. proxy.ts
// only lets any signed-in employee into /admin/business-os, so a page that
// forgets this would be open to every role.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}
const files = walk("app/admin/business-os").filter((f) => /(page\.tsx|route\.ts)$/.test(f));

describe("Business OS pages and routes check the caller", () => {
  it("finds them", () => expect(files.length).toBeGreaterThan(15));
  for (const f of files) {
    it(f, () => {
      const s = readFileSync(f, "utf8");
      expect(s.includes('from "@/lib/staff-session"'), "uses the database-checked session").toBe(true);
      expect(s.includes("hasPermission("), "checks a permission").toBe(true);
    });
  }
});
