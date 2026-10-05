import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from "next";
import { Analytics } from '@vercel/analytics/next';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { business } from "@/lib/config";
import { CartProvider } from "@/lib/cart/CartContext";

const siteUrl = "https://swd.example";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${business.name} — ${business.fullName}`,
    template: `%s | ${business.name}`,
  },
  description:
    "SWD makes technology easier — devices, accessories, repairs, and connectivity, built around Entebbe, Uganda.",
  openGraph: {
    title: `${business.name} — ${business.tagline}`,
    description:
      "Devices, repairs, and connectivity — technology made simple, starting in Entebbe, Uganda.",
    url: siteUrl,
    siteName: business.name,
    locale: "en_UG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${business.name} — ${business.tagline}`,
    description: "Technology made simple. Starting in Entebbe, Uganda.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <CartProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-navy focus:px-4 focus:py-2 focus:text-white"
          >
            Skip to content
          </a>
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
