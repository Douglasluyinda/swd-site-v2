import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { CartProvider } from '@/lib/cart/CartContext';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://swd-site-v2-qco83wghv-luyindadouglas-9460.vercel.app';

const business = {
  name: 'SWD',
  fullName: 'SWD Technology',
  tagline: 'Technology Made Simple',
};

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
      <body>
        <CartProvider>
          {children}
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}