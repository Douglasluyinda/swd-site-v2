// Seed script — creates one supplier, one category, and the labeled DEMO
// product required for testing the storefront → checkout → order flow.
// Run with: npx tsx --env-file=.env lib/db/seed.ts

import { db } from "./client";
import { categories, products, suppliers } from "./schema";

async function seed() {
  const [electronics] = await db
    .insert(categories)
    .values({ name: "Kitchen & Small Appliances", slug: "kitchen-appliances" })
    .returning();

  const [demoSupplier] = await db
    .insert(suppliers)
    .values({
      name: "DEMO Supplier Co.",
      country: "CN",
      contact: "demo-supplier@example.com",
      website: "https://example.com/demo-supplier",
      apiCapable: false,
      blindDropshipping: true,
      processingTimeDays: 3,
      returnPolicy: "DEMO/TEST DATA — not a real supplier policy.",
      reliabilityScore: 4,
      status: "active",
    })
    .returning();

  await db.insert(products).values({
    sku: "SWD-DEMO-0001",
    title: "Portable Blender (DEMO)",
    slug: "portable-blender-demo",
    description:
      "DEMO/TEST DATA — this product exists to exercise the storefront, " +
      "cart, checkout, payment, and order-tracking flow end to end. It is " +
      "not a real SWD listing. A compact, USB-rechargeable blender for " +
      "smoothies on the go.",
    categoryId: electronics.id,
    images: JSON.stringify([
      "/demo/portable-blender-1.svg",
      "/demo/portable-blender-2.svg",
    ]),
    videos: null,

    supplierId: demoSupplier.id,
    supplierSku: "DEMO-PB-001",
    supplierCost: 20, // DEMO/TEST DATA — not a real SWD business cost
    supplierShipping: 6, // configurable, separate from product cost
    supplierStock: 50,
    supplierUrl: "https://example.com/demo-supplier/portable-blender",
    processingTimeDays: 3,
    deliveryEstimateDays: "7-14",

    sellingPrice: 50, // DEMO/TEST DATA
    currency: "USD",
    customerShipping: 4,

    stockStatus: "in_stock",
    status: "published",
    isDemo: true,
  });

  console.log("Seed complete: 1 category, 1 supplier, 1 demo product.");
}

seed()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
