"use client";

import { useRouter } from "next/navigation";

export function AdminSignOut() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        // The cached till page holds the product catalogue: remove it on sign-out.
        // (The unsynced sale queue is deliberately kept — it is unrecorded money.)
        try { await caches.delete("swd-pos-shell-v1"); } catch { /* no Cache API */ }
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
