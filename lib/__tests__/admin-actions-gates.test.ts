// Regression net: server actions can be invoked from any page URL, so EVERY
// exported action in admin-actions.ts must check the caller's role itself.
// This fails if someone adds an action with no permission check.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("lib/admin-actions.ts", "utf8");
const chunks = src.split(/\n(?=export async function )/).slice(1);
const HELPERS = /requireStoreAdmin\(|requireStaff\(|requireStaffManage\(|requireCashStaff\(|repairAction\(|sopAction\(/;

describe("admin server actions are all permission-gated", () => {
  it("finds the actions", () => expect(chunks.length).toBeGreaterThan(40));
  for (const chunk of chunks) {
    const name = /^export async function (\w+)/.exec(chunk)![1];
    it(name, () => {
      const gated = HELPERS.test(chunk) || (chunk.includes("getCurrentStaffSession") && chunk.includes("hasPermission("));
      expect(gated, `${name} has no permission check`).toBe(true);
    });
  }
});

// The staff_role column defaults to OWNER (so existing admins stay owners when the
// column is first added). That is only safe if no code creates an account without
// naming its role.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === "node_modules" || f === ".next" || f === "__tests__") return [];
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("accounts are never created with an implicit role", () => {
  for (const file of [...walk("lib"), ...walk("app")]) {
    const text = readFileSync(file, "utf8");
    const calls = [...text.matchAll(/insert\(admins\)\s*\.values\(([\s\S]*?)\)\s*(?:\.returning|;|\n\s*\.)/g)];
    for (const c of calls) it(`${file}: insert(admins) sets staffRole`, () => expect(c[1]).toMatch(/staffRole/));
  }
});
