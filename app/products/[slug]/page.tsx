import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, relatedProducts } from "@/lib/products";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
import { SectionHeader } from "@/components/SectionHeader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: product.title,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const images: string[] = JSON.parse(product.images);
  const related = (await relatedProducts(product.categoryId, product.slug)).slice(0, 4);

  return (
    <>
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-xl bg-light">
              <Image
                src={images[0]}
                alt={product.title}
                fill
                className="object-contain p-10"
                priority
              />
              {product.isDemo && (
                <span className="absolute left-3 top-3 rounded-full bg-navy/90 px-2.5 py-1 text-xs font-medium text-white">
                  DEMO / TEST DATA
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-4 gap-3">
                {images.slice(1).map((img, i) => (
                  <div
                    key={i}
                    className="relative aspect-square overflow-hidden rounded-lg bg-light"
                  >
                    <Image src={img} alt="" fill className="object-contain p-3" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-navy">
              {product.title}
            </h1>
            <p className="mt-3 text-2xl font-semibold text-navy">
              {product.currency} {product.sellingPrice.toFixed(2)}
            </p>
            <p className="mt-1 text-sm text-slate">
              + {product.currency} {product.customerShipping.toFixed(2)} shipping
              &middot; estimated delivery in {product.deliveryEstimateDays} days
            </p>

            <p className="mt-6 text-[15px] leading-relaxed text-slate">
              {product.description}
            </p>

            <div className="mt-8">
              <AddToCart
                productId={product.id}
                slug={product.slug}
                title={product.title}
                image={images[0]}
                unitPrice={product.sellingPrice}
                customerShipping={product.customerShipping}
                variants={product.variants.map((v) => ({
                  id: v.id,
                  name: v.name,
                  priceDelta: v.priceDelta,
                }))}
                outOfStock={product.stockStatus === "out_of_stock"}
              />
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <SectionHeader title="Related products" />
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
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
        </section>
      )}

      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <Link href="/products" className="text-sm text-blue underline underline-offset-4">
          Back to all products
        </Link>
      </div>
    </>
  );
}
