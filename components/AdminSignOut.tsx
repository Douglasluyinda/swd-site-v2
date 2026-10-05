"use client";

import { useRouter } from "next/navigation";

export function AdminSignOut() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
        router.refresh();
      }}
      className="text-sm text-slate hover:text-navy"
    >
      Sign out
    </button>
  );
}
