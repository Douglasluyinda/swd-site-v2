import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ComingSoonBanner } from "@/components/ComingSoonBanner";
import { Button } from "@/components/Button";

export const metadata: Metadata = {
  title: "Careers",
  description: "Careers at SWD.",
};

export default function CareersPage() {
  return (
    <PageHero
      eyebrow="Careers"
      title="Join SWD"
      description="Open roles will be listed here as SWD builds its founding team ahead of launch."
    >
      <div className="max-w-md space-y-6">
        <ComingSoonBanner label="No open roles listed yet" />
        <Button href="/contact" variant="secondary">
          Get in touch
        </Button>
      </div>
    </PageHero>
  );
}
