import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/SectionHeader";
import { careJourney } from "@/lib/config";

export const metadata: Metadata = {
  title: "SWD Care — Repairs & Technical Support",
  description:
    "Diagnosis, repair, and after-sales support for the devices you already own.",
};

export default function CarePage() {
  return (
    <>
      <PageHero
        eyebrow="SWD Care"
        title="Repairs and support, done properly"
        description="Devices don't need to be replaced at the first sign of trouble. SWD Care diagnoses the problem, explains the options, and fixes it right."
      >
        <Button href="/repairs">Request a repair</Button>
      </PageHero>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeader title="How it works" />
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {careJourney.map((step, i) => (
            <li key={step.step}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-medium text-white">
                  {i + 1}
                </span>
                <p className="text-lg font-semibold text-navy">{step.step}</p>
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-slate">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
