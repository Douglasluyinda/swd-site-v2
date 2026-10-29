import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/SectionHeader";
import { listCategories, listProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "Oraimo",
  description: "Oraimo earbuds, power banks, chargers, and accessories from SWD Access.",
};

// Category tiles shown here are informational (what the collection is
// organized into), independent of whether any product has been published
// in that category yet — avoids an empty page before the first listing
// goes live, without claiming stock that doesn't exist.
const ORAIMO_CATEGORY_SLUGS = [
  "earbuds-headphones",
  "power-banks",
  "chargers-cables",
  "smartwatches",
  "speakers",
  "home-appliances",
];

export default async function OraimoPage() {
  const [items, categories] = await Promise.all([
    listProducts({ brand: "Oraimo" }),
    listCategories(),
  ]);
  const oraimoCategories = categories.filter((c) => ORAIMO_CATEGORY_SLUGS.includes(c.slug));

  return (
    <>
      <PageHero
        eyebrow="SWD Access × Oraimo"
        title="The Oraimo collection"
        description="Earbuds, power banks, chargers, smartwatches, speakers, and small appliances — carried by SWD Access in Entebbe and across Uganda."
      >
        <Button href="/products?brand=Oraimo">
          {items.length > 0 ? `Shop ${items.length} product${items.length === 1 ? "" : "s"}` : "View the collection"}
        </Button>
      </PageHero>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <SectionHeader
          title="Shop by category"
          description={
            items.length === 0
              ? "Products are added here as they're confirmed and stocked — check back soon."
              : undefined
          }
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {oraimoCategories.map((c) => (
            <a
              key={c.id}
              href={`/products?brand=Oraimo&category=${c.slug}`}
              className="block rounded-xl border border-border bg-white p-5 transition-colors hover:border-navy"
            >
              <p className="font-semibold text-navy">{c.name}</p>
              {c.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-slate">{c.description}</p>
              )}
            </a>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-light">
        <div className="mx-auto max-w-6xl px-5 py-12 text-sm leading-relaxed text-slate sm:px-8">
          <p>
            Oraimo is a third-party electronics brand. SWD sells genuine Oraimo products sourced
            through our suppliers; SWD is not presented as an official Oraimo distributor or
            authorised dealer unless that status has been confirmed. Where a listing links out to
            a partner site instead of SWD&apos;s own checkout, that&apos;s disclosed on the
            product page.
          </p>
        </div>
      </section>
    </>
  );
}
