import Link from "next/link";

type PillarCardProps = {
  name: string;
  short: string;
  description: string;
  href: string;
  status: "live" | "comingSoon";
  featured?: boolean;
};

export function PillarCard({
  name,
  short,
  description,
  href,
  status,
  featured = false,
}: PillarCardProps) {
  const isComingSoon = status === "comingSoon";

  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between rounded-xl p-6 transition-colors duration-150 ${
        featured
          ? "bg-navy text-white hover:bg-[#0c2238]"
          : isComingSoon
            ? "border border-dashed border-border-strong bg-transparent hover:border-navy"
            : "border border-border bg-white hover:border-navy"
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <h3
            className={`text-xl font-semibold ${featured ? "text-white" : "text-navy"}`}
          >
            {name}
          </h3>
          {isComingSoon && (
            <span className="shrink-0 rounded-full border border-border-strong px-2.5 py-0.5 text-xs text-slate">
              Coming soon
            </span>
          )}
        </div>
        <p
          className={`mt-1 text-sm font-medium ${featured ? "text-cyan" : "text-blue"}`}
        >
          {short}
        </p>
        <p
          className={`mt-3 text-[15px] leading-relaxed ${featured ? "text-white/80" : "text-slate"}`}
        >
          {description}
        </p>
      </div>
      <span
        className={`mt-6 inline-block text-sm font-medium underline decoration-1 underline-offset-4 ${
          featured
            ? "decoration-white/40 text-white group-hover:decoration-white"
            : "decoration-border-strong text-navy group-hover:decoration-navy"
        }`}
      >
        {isComingSoon ? "See what's planned" : "See how it works"}
      </span>
    </Link>
  );
}
