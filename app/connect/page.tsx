import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/SectionHeader";

export const metadata: Metadata = {
  title: "SWD Connect — Connectivity & Digital Convenience",
  description:
    "Data, connectivity, and digital-convenience services that keep you online and moving.",
};

const offerings = [
  { name: "Connectivity", description: "Getting and staying online, without the runaround." },
  { name: "Digital convenience", description: "Everyday digital services handled in one place." },
  { name: "Ongoing support", description: "Help when a connection or service isn't working as expected." },
];

export default function ConnectPage() {
  return (
    <>
      <PageHero
        eyebrow="SWD Connect"
        title="Staying connected, made simple"
        description="Connectivity and digital-convenience services designed to work alongside SWD Access and SWD Care."
      >
        <Button href="/contact" variant="secondary">
          Ask about Connect
        </Button>
      </PageHero>

      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeader title="What SWD Connect covers" />
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {offerings.map((o) => (
            <div key={o.name} className="rounded-xl border border-border bg-white p-6">
              <p className="text-lg font-semibold text-navy">{o.name}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-slate">
                {o.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
