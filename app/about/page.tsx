import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "About",
  description: "Why SWD exists, and what it's building toward.",
};

const values = [
  { name: "Useful", description: "Technology should solve a real problem, not just look impressive." },
  { name: "Accessible", description: "Good technology shouldn't be hard to find or afford." },
  { name: "Understandable", description: "No jargon standing between you and what you need." },
  { name: "Convenient", description: "Support that fits into your day, not the other way around." },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About SWD"
        title="Technology should be simpler than this"
        description="SWD started from a simple observation: getting good technology — and keeping it working — is more complicated than it needs to be. We're building a straightforward alternative, starting in Entebbe, Uganda."
      />

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-blue">Mission</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-navy">
              Make reliable technology and digital services accessible, convenient, and useful.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-cyan">Vision</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-navy">
              Become a trusted East African technology and digital-services brand.
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <SectionHeader title="What that looks like in practice" />
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((v) => (
              <div key={v.name}>
                <p className="text-lg font-semibold text-navy">{v.name}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
          See what SWD offers
        </h2>
        <div className="mt-8 flex justify-center">
          <Button href="/services">Explore services</Button>
        </div>
      </section>
    </>
  );
}
