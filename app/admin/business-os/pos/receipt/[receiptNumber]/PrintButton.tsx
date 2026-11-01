"use client";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="w-full rounded-lg bg-light px-4 py-2 text-sm font-medium text-navy hover:bg-border print:hidden">
      Print receipt
    </button>
  );
}
