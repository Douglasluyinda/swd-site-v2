import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ComingSoonBanner } from "@/components/ComingSoonBanner";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/SectionHeader";
import { careJourney } from "@/lib/config";

export const metadata: Metadata = {
  title: "Repairs",
  description: "Request a repair with SWD Care.",
};

export default function RepairsPage() {
  return (
    <>
      <PageHero
        eyebrow="Repairs"
        title="Request a repair"
        description="Online repair tracking is being built. For now, reach out directly and we'll take it from there."
      >
        <div className="max-w-md">
          <ComingSoonBanner label="Online repair tracking coming soon" />
        </div>
      </PageHero>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeader title="How a repair will work" />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {careJourney.map((step, i) => (
            <li key={step.step}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-medium text-white">
                  {i + 1}
                </span>
                <p className="text-lg font-semibold text-navy">{step.step}</p>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-slate">{step.description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Button href="/contact">Start a repair enquiry</Button>
        </div>
      </section>
    </>
  );
}
