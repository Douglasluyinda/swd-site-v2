import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { ComingSoonBanner } from "@/components/ComingSoonBanner";

export const metadata: Metadata = {
  title: "Insights",
  description: "Articles and updates from SWD.",
};

export default function InsightsPage() {
  return (
    <PageHero
      eyebrow="Insights"
      title="Insights, coming soon"
      description="Practical articles on devices, repairs, and staying connected — published as SWD launches."
    >
      <div className="max-w-md">
        <ComingSoonBanner label="Articles coming soon" />
      </div>
    </PageHero>
  );
}
