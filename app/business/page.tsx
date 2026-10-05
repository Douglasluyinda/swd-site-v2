import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/Button";
import { ComingSoonBanner } from "@/components/ComingSoonBanner";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "SWD Business — Technology Solutions for SMEs",
  description: "Technology support built for small and growing businesses. In development.",
};

const focus = [
  { name: "Device supply", description: "Equipping teams with reliable devices." },
  { name: "Ongoing support", description: "Keeping business technology running, not just fixed once." },
  { name: "Connectivity", description: "Connectivity built around how a business actually works." },
];

export default function BusinessPage() {
  return (
    <>
      <PageHero
        eyebrow="SWD Business"
        title="Technology support for small businesses"
        description="SWD Business extends SWD Access, Care, and Connect to teams and small businesses. It's still in development."
      >
        <div className="max-w-md">
          <ComingSoonBanner label="SWD Business is in development" />
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeader title="What we're building toward" />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {focus.map((f) => (
            <div key={f.name} className="rounded-xl border border-dashed border-border-strong p-6">
              <p className="text-lg font-semibold text-navy">{f.name}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">{f.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Button href="/contact">Tell us what your business needs</Button>
        </div>
      </section>
    </>
  );
}
