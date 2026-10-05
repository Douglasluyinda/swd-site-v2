// Bootstrap the first admin account. Run once:
//   npx tsx --env-file=.env lib/db/seed-admin.ts <email> <password> [name]
//
// After the first admin exists, create additional admins from
// Admin → Settings while logged in — this script is only for the
// chicken-and-egg problem of creating account #1.

import { db } from "./client";
import { admins } from "./schema";
import { hashPassword } from "../admin-auth";
import { eq } from "drizzle-orm";

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: seed-admin.ts <email> <password> [name]");
    process.exit(1);
  }

  const [existing] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (existing) {
    console.log(`Admin ${email} already exists.`);
    process.exit(0);
  }

  const passwordHash = await hashPassword(password);
  await db.insert(admins).values({ email, passwordHash, name: name ?? email, role: "admin" });
  console.log(`Created admin: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
