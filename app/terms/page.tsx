import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <PageHero
      eyebrow="Legal"
      title="Terms of service"
      description="SWD's full terms of service will be published ahead of launch."
    />
  );
}
