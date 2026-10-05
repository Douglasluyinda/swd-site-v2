import { db } from "./db/client";
import { categories, productVariants, products, suppliers } from "./db/schema";
import { and, eq, like, or } from "drizzle-orm";

export type ProductListItem = Awaited<ReturnType<typeof listProducts>>[number];

export async function listProducts(opts?: { categorySlug?: string; search?: string }) {
  const conditions = [eq(products.status, "published")];

  if (opts?.search) {
    const term = `%${opts.search}%`;
    conditions.push(
      or(like(products.title, term), like(products.description, term))!,
    );
  }

  const rows = await db
    .select({
      id: products.id,
      title: products.title,
      slug: products.slug,
      images: products.images,
      sellingPrice: products.sellingPrice,
      currency: products.currency,
      customerShipping: products.customerShipping,
      stockStatus: products.stockStatus,
      deliveryEstimateDays: products.deliveryEstimateDays,
      isDemo: products.isDemo,
      categorySlug: categories.slug,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .where(and(...conditions));

  return opts?.categorySlug
    ? rows.filter((r) => r.categorySlug === opts.categorySlug)
    : rows;
}

export async function listCategories() {
  return db.select().from(categories);
}

export async function getProductBySlug(slug: string) {
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.slug, slug), eq(products.status, "published")))
    .limit(1);

  if (!product) return null;

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, product.id));

  const [supplier] = await db
    .select({ processingTimeDays: suppliers.processingTimeDays })
    .from(suppliers)
    .where(eq(suppliers.id, product.supplierId))
    .limit(1);

  return { ...product, variants, supplierProcessingDays: supplier?.processingTimeDays };
}

export async function relatedProducts(categoryId: string, excludeSlug: string) {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.categoryId, categoryId), eq(products.status, "published")));

  return rows.filter((p) => p.slug !== excludeSlug);
}
