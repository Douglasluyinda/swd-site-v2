// Creates the category rows the Oraimo collection is organized into.
// Idempotent — safe to run more than once (categories.slug is unique,
// re-running skips ones that already exist).
//
// This seeds CATEGORIES ONLY, never products. Oraimo products must be
// added through /admin/products with real, verified SKUs, prices and
// stock — no placeholder/demo Oraimo listings are created here, since
// inventing specs, pricing or availability would misrepresent the
// business (see DELIVERY.md).
//
// Run:
//   npx tsx --env-file=.env lib/db/seed-oraimo-categories.ts

import { db } from "./client";
import { categories } from "./schema";
import { eq } from "drizzle-orm";

const ORAIMO_CATEGORIES = [
  { name: "Earbuds & Headphones", slug: "earbuds-headphones", description: "Oraimo wireless earbuds, headphones, and audio accessories." },
  { name: "Power Banks", slug: "power-banks", description: "Portable power banks for phones, tablets, and everyday devices." },
  { name: "Chargers & Cables", slug: "chargers-cables", description: "Wall chargers, car chargers, and charging cables." },
  { name: "Smartwatches", slug: "smartwatches", description: "Oraimo smartwatches and fitness bands." },
  { name: "Speakers", slug: "speakers", description: "Portable and home Bluetooth speakers." },
  { name: "Home Appliances", slug: "home-appliances", description: "Small home appliances and everyday electronics." },
];

async function main() {
  let created = 0;
  for (const category of ORAIMO_CATEGORIES) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, category.slug))
      .limit(1);
    if (existing) continue;
    await db.insert(categories).values(category);
    created++;
  }
  console.log(`Oraimo categories: ${created} created, ${ORAIMO_CATEGORIES.length - created} already existed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
