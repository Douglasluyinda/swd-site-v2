import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ProductCard } from "@/components/ProductCard";
import { listCategories, listProducts } from "@/lib/products";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Products",
  description: "The SWD Access product catalogue.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const params = await searchParams;
  const items = await listProducts({ categorySlug: params.category, search: params.q });
  const categories = await listCategories();

  return (
    <>
      <PageHero
        eyebrow="Products"
        title="SWD Access catalogue"
        description="Products carried by SWD Access. More categories are added as the catalogue grows toward launch."
      />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <form className="flex-1 sm:max-w-sm">
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
              href="/products"
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
                href={`/products?category=${c.slug}`}
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
                slug={p.slug}
                title={p.title}
                image={JSON.parse(p.images)[0]}
                price={p.sellingPrice}
                currency={p.currency}
                stockStatus={p.stockStatus}
                isDemo={p.isDemo}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
