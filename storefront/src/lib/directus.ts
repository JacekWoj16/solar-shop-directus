import { createDirectus, rest, staticToken } from '@directus/sdk';

import type { Order, OrderItem } from '@/types/order';
import type { Page } from '@/types/page';
import type { Category, PriceTier, Product } from '@/types/product';

/**
 * Directus client configuration.
 *
 * Two clients, deliberately separate:
 *
 *   `directus`      — anonymous, read-only. Everything the storefront renders
 *                     (categories, products, tiers, pages) is public, so the
 *                     catalogue needs no credentials and can be cached by ISR.
 *
 *   `directusAdmin` — authenticated with a server-only static token, used from
 *                     route handlers to write orders. The token is read from
 *                     `DIRECTUS_STATIC_TOKEN` (no `NEXT_PUBLIC_` prefix), so it
 *                     can never be bundled into client JavaScript.
 */

/**
 * Collections as the REST API returns them, with relational fields still
 * expressed as foreign keys. Application code works with the expanded types in
 * `@/types/*` after a `fields` query has resolved the relations.
 */
export interface DirectusSchema {
  categories: Category[];
  products: Array<Omit<Product, 'category' | 'price_tiers'> & {
    category: string | Category;
    price_tiers: Array<string | PriceTier>;
  }>;
  price_tiers: Array<PriceTier & { product: string | Product }>;
  orders: Array<Omit<Order, 'items'> & { items: Array<string | OrderItem> }>;
  order_items: Array<OrderItem & { order: string }>;
  pages: Page[];
}

/** Server-side base URL. Falls back to the docker-compose default. */
export const DIRECTUS_URL =
  process.env.DIRECTUS_URL ??
  process.env.NEXT_PUBLIC_DIRECTUS_URL ??
  'http://localhost:8055';

/** Browser-visible base URL, used to build asset links rendered in the DOM. */
export const DIRECTUS_PUBLIC_URL =
  process.env.NEXT_PUBLIC_DIRECTUS_URL ?? DIRECTUS_URL;

/**
 * Read client.
 *
 * Deliberately uncached at the fetch layer. Caching is declared one level up,
 * in `lib/api.ts`, where a `use cache` function caches its *result* — the
 * normalised domain objects — rather than the raw HTTP response. That caches
 * the parsing and normalisation too, and keeps one cache to reason about
 * instead of two nested ones with different lifetimes.
 */
export function directusClient() {
  return createDirectus<DirectusSchema>(DIRECTUS_URL).with(
    rest({
      onRequest: (options) => ({ ...options, cache: 'no-store' }),
    }),
  );
}

export const directus = directusClient();

/**
 * Write client for order creation. Throws rather than silently degrading to an
 * anonymous client, because a missing token would otherwise surface as an
 * opaque 403 at checkout.
 */
export function directusAdmin() {
  const token = process.env.DIRECTUS_STATIC_TOKEN;

  if (!token) {
    throw new Error(
      'DIRECTUS_STATIC_TOKEN is not set. Orders cannot be created without a ' +
        'server-side Directus token — see .env.example.',
    );
  }

  return createDirectus<DirectusSchema>(DIRECTUS_URL)
    .with(staticToken(token))
    .with(rest({ onRequest: (options) => ({ ...options, cache: 'no-store' }) }));
}

/** Absolute URL of a file stored in Directus (used for generated proformas). */
export function assetUrl(fileId: string): string {
  return `${DIRECTUS_PUBLIC_URL}/assets/${fileId}`;
}
