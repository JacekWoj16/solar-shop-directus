import type { Metadata, Viewport } from 'next';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import '@/styles/globals.css';

/**
 * Root layout.
 *
 * The interface is in English while the commercial domain stays Polish — PLN,
 * net prices, 23% VAT, NIP validation, proforma invoices — because the shop
 * trades under Polish rules but the codebase is read internationally.
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Solaris Components — B2B photovoltaic wholesale',
    template: '%s · Solaris Components',
  },
  description:
    'Wholesale photovoltaic panels, inverters, mounting systems and accessories ' +
    'for installers and resellers. Volume pricing, net prices, bank transfer.',
  openGraph: {
    type: 'website',
    siteName: 'Solaris Components',
    locale: 'en_GB',
  },
  robots: {
    // A portfolio deployment has no business appearing in search results.
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1c1917',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>

        <Header />

        <main id="main" className="flex-1">
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
