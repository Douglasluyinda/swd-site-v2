import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { PillarCard } from "@/components/PillarCard";
import { featureStatus, pillars } from "@/lib/config";

export const metadata: Metadata = {
  title: "Services",
  description: "All SWD services: Access, Care, Connect, and Business.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Everything SWD offers, in one place"
        description="Four pillars, each solving a different part of the same problem: technology that's harder to use than it should be."
      />
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-2">
          {pillars.map((p) => (
            <PillarCard
              key={p.key}
              name={p.name}
              short={p.short}
              description={p.description}
              href={p.href}
              status={featureStatus[p.key]}
            />
          ))}
        </div>
      </section>
    </>
  );
}
