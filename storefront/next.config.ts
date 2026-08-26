import type { NextConfig } from 'next';

/**
 * Product photography is served from an external CDN (`products.image_url` in
 * Directus) rather than uploaded into Directus storage — this mirrors the
 * original shop's setup and keeps the CMS database small. Both the CDN and the
 * Directus asset endpoint must therefore be allow-listed for next/image.
 */
const directusUrl = new URL(
  process.env.NEXT_PUBLIC_DIRECTUS_URL ?? 'http://localhost:8055',
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Lets a route combine a prerendered shell with dynamic content streamed into
  // it, instead of being all-or-nothing. The category pages need exactly that:
  // breadcrumb, heading and ordering rules are static per category, while the
  // table itself varies with ?sort and ?page.
  //
  // With this enabled, `export const revalidate` is gone: caching is declared
  // where the data is read, with `use cache` + `cacheLife`, rather than at the
  // route segment. Anything not marked cacheable is dynamic by default, which
  // is the safer direction for a shop — a price is never stale by accident.
  cacheComponents: true,

  cacheLife: {
    // Product data: prices are renegotiated weekly, stock moves daily.
    catalogue: { stale: 300, revalidate: 1800, expire: 3600 },
    // The shape of the shop — categories and editorial pages.
    structure: { stale: 600, revalidate: 3600, expire: 86_400 },
  },

  images: {
    formats: ['image/webp'],
    remotePatterns: [
      {
        protocol: directusUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: directusUrl.hostname,
        port: directusUrl.port,
        pathname: '/assets/**',
      },
      // Placeholder product imagery used by the seed data.
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'fastly.picsum.photos' },
    ],
  },

  // @react-pdf/renderer is only ever used inside route handlers; keeping it
  // external stops the bundler from pulling its font/canvas deps into the
  // client graph.
  serverExternalPackages: ['@react-pdf/renderer'],

  // Type errors must fail the build; Next 16 dropped the `eslint` block, so
  // linting runs as its own `npm run lint` step.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
