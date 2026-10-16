import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/Button";
import { PillarCard } from "@/components/PillarCard";
import { SectionHeader } from "@/components/SectionHeader";
import { business, pillars, principles, featureStatus } from "@/lib/config";

export const metadata: Metadata = {
  description:
    "SWD makes technology easier — devices, accessories, repairs, and connectivity, built around Entebbe, Uganda.",
};

export default function HomePage() {
  return (
    <>
      <section className="border-b border-border bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-blue">{business.fullName}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-navy sm:text-6xl">
              {business.tagline}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-slate">
              Devices, repairs, and connectivity from one place in {business.city},{" "}
              {business.country} — chosen for reliability, explained in plain language,
              backed by support that doesn&apos;t disappear after the sale.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/products">Shop products</Button>
              <Button href="/services" variant="secondary">
                Explore services
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeader
          title="Four ways SWD helps"
          description="Each pillar stands on its own — use one or use them together."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, i) => (
            <PillarCard
              key={pillar.key}
              name={pillar.name}
              short={pillar.short}
              description={pillar.description}
              href={pillar.href}
              status={featureStatus[pillar.key]}
              featured={i === 0}
            />
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-light">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <SectionHeader title="What we hold ourselves to" />
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {principles.map((principle) => (
              <div key={principle.name}>
                <p className="text-lg font-semibold text-navy">{principle.name}</p>
                <p className="mt-2 text-[15px] leading-relaxed text-slate">
                  {principle.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
          Have a device question before launch?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-slate">
          SWD is building towards launch in {business.launchMonth}. Reach out and we&apos;ll
          get back to you directly.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button href="/contact">Contact SWD</Button>
          <Link
            href="/about"
            className="inline-flex items-center justify-center px-5 py-3 text-[15px] font-medium text-navy underline decoration-border-strong decoration-1 underline-offset-4 hover:decoration-navy"
          >
            About SWD
          </Link>
        </div>
      </section>
    </>
  );
}
