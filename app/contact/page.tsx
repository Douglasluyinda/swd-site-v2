import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ContactForm } from "@/components/ContactForm";
import { contact } from "@/lib/config";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with SWD.",
};

const channels = [
  { label: "Phone", value: contact.phone },
  { label: "Email", value: contact.email },
  { label: "WhatsApp", value: contact.whatsapp },
  { label: "Location", value: contact.address },
  { label: "Hours", value: contact.hours },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to SWD"
        description="Questions about a product, a repair, or SWD Business — send a message and we'll get back to you."
      />

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-6">
            {channels.map((c) => (
              <div key={c.label}>
                <p className="text-sm font-medium text-slate">{c.label}</p>
                <p className="mt-1 text-[15px] text-navy">
                  {c.value.startsWith("CONFIRM_") ? "To be confirmed" : c.value}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-white p-6 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
