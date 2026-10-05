import { business } from "@/lib/config";

export function ComingSoonBanner({ label }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-lg border border-cyan/40 bg-cyan/10 px-4 py-3 text-sm text-navy"
    >
      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-cyan" />
      <p>
        {label ?? "This is in development"} — expect it live around SWD&apos;s
        launch in {business.launchMonth}. Reach out and we&apos;ll let you know
        as soon as it&apos;s ready.
      </p>
    </div>
  );
}
