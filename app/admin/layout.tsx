import Link from "next/link";
import { cookies } from "next/headers";
import { AdminSignOut } from "@/components/AdminSignOut";
import { ADMIN_COOKIE, isValidSessionToken } from "@/lib/admin-auth";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/suppliers", label: "Suppliers" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/fulfillment", label: "Fulfillment" },
  { href: "/admin/shipping", label: "Shipping" },
  { href: "/admin/marketing", label: "Marketing" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const authed = await isValidSessionToken(cookieStore.get(ADMIN_COOKIE)?.value);

  if (!authed) {
    // Login page (or an unauthenticated hit that middleware hasn't caught
    // yet) — render without the sidebar chrome.
    return <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">{children}</div>;
  }

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-5 py-10 sm:px-8">
      <aside className="hidden w-48 shrink-0 md:block">
        <p className="mb-4 px-2 text-sm font-semibold text-navy">SWD Admin</p>
        <nav className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-2 py-2 text-sm text-slate hover:bg-white hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6 px-2">
          <AdminSignOut />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
