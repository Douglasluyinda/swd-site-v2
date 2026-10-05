import Link from "next/link";
import { business, contact, pillars } from "@/lib/config";

const explore = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Products", href: "/products" },
  { label: "Insights", href: "/insights" },
];

const help = [
  { label: "Contact", href: "/contact" },
  { label: "Repairs", href: "/repairs" },
  { label: "Careers", href: "/careers" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-navy text-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-lg font-bold tracking-tight">{business.name}</p>
            <p className="mt-1 text-sm text-white/60">{business.fullName}</p>
            <p className="mt-4 text-sm text-cyan">{business.tagline}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-white/50">Explore</p>
            <ul className="mt-3 space-y-2.5">
              {explore.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-white/80 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium text-white/50">Services</p>
            <ul className="mt-3 space-y-2.5">
              {pillars.map((p) => (
                <li key={p.key}>
                  <Link
                    href={p.href}
                    className="text-sm text-white/80 hover:text-white"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-medium text-white/50">Help</p>
            <ul className="mt-3 space-y-2.5">
              {help.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-white/80 hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-white/50">{contact.address}</p>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} {business.name}. All rights
            reserved.
          </p>
          <div className="flex gap-5">
            <Link href="/privacy" className="text-xs text-white/50 hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="text-xs text-white/50 hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
