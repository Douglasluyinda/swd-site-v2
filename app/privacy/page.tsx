import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <PageHero
      eyebrow="Legal"
      title="Privacy policy"
      description="SWD's full privacy policy will be published ahead of launch, covering how enquiry, contact, and repair information is collected and used."
    />
  );
}
