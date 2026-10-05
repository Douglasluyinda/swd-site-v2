type SectionHeaderProps = {
  title: string;
  description?: string;
  align?: "left" | "center";
};

export function SectionHeader({
  title,
  description,
  align = "left",
}: SectionHeaderProps) {
  return (
    <div
      className={`max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-navy">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-lg text-slate leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
