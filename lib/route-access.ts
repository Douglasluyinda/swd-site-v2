// Which /admin pages a signed-in role may open at all (checked in proxy.ts, on
// the Edge). Pages and server actions still check their own permissions: this is
// only the outer wall. Pure, no imports beyond rbac.
import { hasPermission } from "@/lib/rbac";

export function adminPathAllowed(role: string | null | undefined, pathname: string): boolean {
  if (pathname === "/admin/login") return true;
  if (pathname === "/admin/business-os" || pathname.startsWith("/admin/business-os/")) return !!role; // each page checks its own permission
  if (pathname === "/admin/settings" || pathname.startsWith("/admin/settings/")) return hasPermission(role, "staff.manage"); // can create admins
  return hasPermission(role, "store.manage"); // orders, products, suppliers, coupons, payments, fulfilment, shipping, marketing, analytics, dashboard
}
