import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ProductCard } from "@/components/ProductCard";
import { listCategories, listProducts } from "@/lib/products";
import Link from "next/link";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}): Promise<Metadata> {
  const { brand } = await searchParams;
  return brand
    ? { title: `${brand} products`, description: `${brand} products carried by SWD Access.` }
    : { title: "Products", description: "The SWD Access product catalogue." };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; brand?: string }>;
}) {
  const params = await searchParams;
  const items = await listProducts({
    categorySlug: params.category,
    search: params.q,
    brand: params.brand,
  });
  const categories = await listCategories();

  // Preserve brand/search filters when switching category, and vice versa.
  function categoryHref(categorySlug?: string) {
    const qs = new URLSearchParams();
    if (categorySlug) qs.set("category", categorySlug);
    if (params.brand) qs.set("brand", params.brand);
    if (params.q) qs.set("q", params.q);
    const query = qs.toString();
    return query ? `/products?${query}` : "/products";
  }

  return (
    <>
      <PageHero
        eyebrow={params.brand ? `${params.brand} collection` : "Products"}
        title={params.brand ? `${params.brand} products` : "SWD Access catalogue"}
        description={
          params.brand
            ? `${params.brand} devices and accessories carried by SWD Access.`
            : "Products carried by SWD Access. More categories are added as the catalogue grows toward launch."
        }
      />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <form className="flex-1 sm:max-w-sm">
            {params.brand && <input type="hidden" name="brand" value={params.brand} />}
            <input
              type="search"
              name="q"
              defaultValue={params.q}
              placeholder="Search products…"
              className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] focus:border-blue"
            />
          </form>
          <div className="flex flex-wrap gap-2">
            <Link
              href={categoryHref()}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                !params.category
                  ? "border-navy bg-navy text-white"
                  : "border-border-strong text-slate hover:border-navy"
              }`}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={categoryHref(c.slug)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  params.category === c.slug
                    ? "border-navy bg-navy text-white"
                    : "border-border-strong text-slate hover:border-navy"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-16 rounded-xl border border-dashed border-border-strong p-12 text-center">
            <p className="text-lg font-semibold text-navy">No products found</p>
            <p className="mt-2 text-slate">
              Try a different search, or check back as the catalogue grows.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((p) => (
              <ProductCard
                key={p.id}
                slug={p.slug ?? ""}
                title={p.title}
                image={JSON.parse(p.images ?? "[]")[0]}
                price={p.sellingPrice ?? 0}
                currency={p.currency ?? "UGX"}
                stockStatus={p.stockStatus ?? ""}
                isDemo={p.isDemo ?? false}
                brand={p.brand}
                fulfillmentType={p.fulfillmentType}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
