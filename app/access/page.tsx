import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "SWD Access — Products & Accessories",
  description:
    "Devices, accessories, and everyday technology products from SWD, chosen for reliability.",
};

const categories = [
  {
    name: "Devices",
    description: "Phones and everyday devices, selected for reliability over trend.",
  },
  {
    name: "Accessories",
    description: "Chargers, cases, cables, and the small things that make devices last.",
  },
  {
    name: "Connectivity add-ons",
    description: "Accessories that pair with SWD Connect services.",
  },
];

export default function AccessPage() {
  return (
    <>
      <PageHero
        eyebrow="SWD Access"
        title="Products & accessories, chosen with intent"
        description="SWD Access isn't about carrying everything — it's about carrying what's reliable. A catalogue is being finalized ahead of launch."
      >
        <div className="flex flex-wrap gap-3">
          <Button href="/products">See the catalogue</Button>
          <Button href="/contact" variant="secondary">
            Ask about a product
          </Button>
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeader title="What SWD Access will carry" />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {categories.map((c) => (
            <div key={c.name} className="rounded-xl border border-border bg-white p-6">
              <p className="text-lg font-semibold text-navy">{c.name}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">
                {c.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
