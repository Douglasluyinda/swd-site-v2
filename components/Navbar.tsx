"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pillars } from "@/lib/config";
import { Button } from "@/components/Button";
import { useCart } from "@/lib/cart/CartContext";

const navLinks = [
  { label: "Products", href: "/products" },
  { label: "About", href: "/about" },
  { label: "Insights", href: "/insights" },
];

function CartLink() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      className="relative flex h-10 w-10 items-center justify-center rounded-md text-navy hover:bg-navy/5"
      aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 6h15l-1.5 9h-12L6 3H3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9" cy="20" r="1.5" fill="currentColor" />
        <circle cx="18" cy="20" r="1.5" fill="currentColor" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue px-1 text-[10px] font-medium text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-light/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex flex-col leading-none">
          <span className="text-xl font-bold tracking-tight text-navy">
            SWD
          </span>
          <span className="text-[11px] text-slate">
            Smart Devices &amp; Digital Services
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button
              className="text-[15px] text-charcoal hover:text-navy"
              aria-expanded={servicesOpen}
              aria-haspopup="true"
              onClick={() => setServicesOpen((v) => !v)}
            >
              Services
            </button>
            {servicesOpen && (
              <div className="absolute left-1/2 top-full w-80 -translate-x-1/2 pt-3">
                <div className="rounded-xl border border-border bg-white p-3 shadow-lg shadow-navy/5">
                  {pillars.map((p) => (
                    <Link
                      key={p.key}
                      href={p.href}
                      className="block rounded-lg px-3 py-2.5 hover:bg-light"
                    >
                      <span className="block text-sm font-medium text-navy">
                        {p.name}
                      </span>
                      <span className="block text-xs text-slate">
                        {p.short}
                      </span>
                    </Link>
                  ))}
                  <Link
                    href="/services"
                    className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-medium text-blue hover:bg-light"
                  >
                    All services
                  </Link>
                </div>
              </div>
            )}
          </div>
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[15px] text-charcoal hover:text-navy"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <CartLink />
          <Button href="/contact" variant="primary" className="!py-2.5">
            Contact SWD
          </Button>
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-1 md:hidden">
          <CartLink />
          <button
            className="flex h-10 w-10 items-center justify-center rounded-md text-navy"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 top-[65px] z-30 overflow-y-auto bg-light md:hidden">
          <nav className="flex flex-col gap-1 px-5 py-6">
            <p className="px-2 pb-2 text-sm font-medium text-slate">
              Services
            </p>
            {pillars.map((p) => (
              <Link
                key={p.key}
                href={p.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-3 text-lg text-charcoal hover:bg-white"
              >
                {p.name}
              </Link>
            ))}
            <div className="my-3 h-px bg-border" />
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-3 text-lg text-charcoal hover:bg-white"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-4 px-2">
              <Button
                href="/contact"
                className="w-full"
                variant="primary"
              >
                Contact SWD
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
