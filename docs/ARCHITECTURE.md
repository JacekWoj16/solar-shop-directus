# Architecture

How the store is put together, and why. This document covers the decisions that
are not obvious from reading the code; the data model has its own document in
[data-model.md](./data-model.md).

## Shape of the system

```
┌──────────────┐        REST (anonymous, cached)        ┌──────────────────┐
│              │ ────────────────────────────────────▶  │                  │
│  Next.js 16  │        catalogue reads                 │   Directus 11    │
│  storefront  │                                        │   (headless CMS) │
│              │ ◀────────────────────────────────────  │                  │
│              │        REST (static token, uncached)   │                  │
└──────┬───────┘        order writes                    └────────┬─────────┘
       │                                                         │
       │ localStorage                                            │ SQL
       ▼                                                         ▼
┌──────────────┐                                        ┌──────────────────┐
│  Cart state  │                                        │  PostgreSQL 16   │
│  (Zustand)   │                                        └──────────────────┘
└──────────────┘
```

Directus owns the data and the admin experience. The storefront owns rendering,
pricing presentation and the order flow. There is no bespoke backend between
them: Directus derives its API from the database schema, so adding a field is a
schema change rather than a controller change.

## Layers

The storefront is organised by responsibility, not by page:

| Layer | Location | Depends on | Notes |
|---|---|---|---|
| Domain | `src/lib/pricing.ts`, `cart.ts`, `nip.ts`, `format.ts` | nothing | Framework-free. No React, no Next, no fetch. This is what the test suite exercises. |
| Data access | `src/lib/directus.ts`, `src/lib/api.ts` | domain, SDK | Typed queries; the only place that knows about `fields=` and `filter=`. |
| State | `src/stores/cart.store.ts` | domain | A thin Zustand wrapper: persistence and React bindings only. |
| UI | `src/components/**`, `src/app/**` | all of the above | Server components by default; `'use client'` only where interaction demands it. |

The direction of dependency never reverses. The practical payoff: the volume
pricing rules — the part of this project most likely to be wrong — can be tested
in milliseconds with no DOM, no store and no network.

## Rendering strategy

A B2B catalogue is an unusually good fit for static generation: list prices are
renegotiated weekly, stock moves daily, and nobody refreshes a product table
hoping the price changed. Interaction, meanwhile, is entirely local — quantity
inputs and the cart never need the server. That splits the app cleanly:

| Route | Strategy | Window | Reasoning |
|---|---|---|---|
| `/` | ISR | 1 h | Hero copy and category tiles; effectively static. |
| `/products/[category]` | ISR + `generateStaticParams` | 30 min | The main cached surface. Categories are known at build time, so every table is pre-rendered. |
| `/search` | Dynamic | — | The query space is unbounded; there is nothing to pre-render. |
| `/cart`, `/checkout` | Client | — | State lives in `localStorage`; no server round-trip is involved. |
| `/order/[orderId]` | Dynamic, uncached | — | Per-order data that must never be served from a shared cache. |
| `/about`, `/contact`, `/terms` | ISR | 1 h | Editorial content from Directus. |
| `/api/orders`, `/api/proforma/[orderId]` | Route handlers | — | Writes and PDF generation; server-only. |

Two consequences worth knowing:

- **`export const revalidate` must be a literal.** Next evaluates route segment
  config statically at build time and will not resolve an imported constant —
  it fails the build with "Invalid segment configuration export detected".
  Each page therefore declares its own literal with a comment; this table is the
  shared reference.
- **The ISR window is only honoured if the fetch participates in it.** The
  Directus SDK delegates to the platform `fetch`, so `directusClient(seconds)`
  attaches `next: { revalidate }` to every request. Without that hint, page-level
  revalidation would silently do nothing.

## Pricing

Volume pricing is the core business logic, and it is deliberately concentrated
in one module (`src/lib/pricing.ts`) that everything else calls:

- `resolveTier` is forgiving about imperfect data. Tiers are hand-authored by a
  shop owner in an admin panel, so they will eventually be out of order, have
  gaps, or bound their top bracket. A buyer must always see a price when one can
  be reasonably inferred — the only case that yields "no price" is a product
  with no tiers at all, which the UI renders as *contact for a quote* rather
  than as `0`.
- **Money is rounded at every boundary**, through `roundMoney`, with an epsilon
  nudge so that values exact in decimal but not in binary (`1.005`) round the
  way an accountant expects.
- **VAT is computed once on the rounded net subtotal**, not per line. That is
  what a Polish invoice does, and it avoids the grosz of drift that per-line VAT
  accumulates across a large order.

**Prices shown to the buyer are never trusted.** The checkout sends only product
ids and quantities; `POST /api/orders` re-reads the tiers from Directus and
recomputes every line server-side. A tampered `localStorage` cart changes what
the buyer sees and nothing else.

## Cart

The cart is client-side only: Zustand with a `localStorage` persister, no server
session, no account system. For a shop where orders are placed without
registration, a server cart would add a session store, a merge strategy and a
cleanup job while buying nothing.

Each cart line carries a **snapshot** of its product — name, SKU, image, tiers,
and the category's quantity rules — so a returning visitor sees a complete,
correctly priced cart before any network request. The snapshot is refreshed
whenever the product is added again.

Hydration is handled explicitly: the store exposes `hasHydrated`, and selectors
report an empty cart until `localStorage` has been read. Rendering persisted
state during the first client pass would desynchronise it from the server markup.

## Quantity rules

Minimum quantity and step live on the **category**, not the product, because
they express a commercial policy of the whole group — panels ship on pallets of
five, inverters do not. The rules are enforced in three places, deliberately:

1. `QuantityInput` clamps as the buyer types (immediate feedback).
2. `normalizeQuantity` re-applies them on every store write (defends against a
   stale cart whose category rules changed since).
3. The order route validates again before writing (defends against a crafted
   request).

## Security boundaries

- The **public Directus role** has read access to the catalogue only. No token
  is needed to render the store, which is exactly what makes the catalogue
  cacheable.
- `DIRECTUS_STATIC_TOKEN` grants create rights on `orders` and `order_items`.
  It has no `NEXT_PUBLIC_` prefix, is read only inside route handlers, and
  `directusAdmin()` throws loudly if it is missing rather than degrading to an
  anonymous client that would fail with an opaque 403 at checkout.
- Order confirmation pages are addressed by UUID and served uncached.

## Design

The brief is a professional procurement tool, not a consumer shop: **tables over
grids, prices over photography, density over whitespace**. A buyer ordering
forty pallets wants forty rows on screen with an inline quantity field, not
forty cards to scroll past.

The palette is a deliberate departure from the WooCommerce store that inspired
the project — warm stone neutrals instead of cool grays, blue as the primary
instead of a solar green, and orange reserved strictly for commit actions (add
to cart, place order) so the eye learns where the consequential buttons are.
Typography is a system stack: no webfont request, and a different texture from
the original.

Tokens are defined once in `src/styles/globals.css` under Tailwind v4's
`@theme`, and named semantically (`brand`, `ink`, `line`, `price`) rather than
literally. A palette change stays a one-file edit, and no component hard-codes a
hue.

## Testing

The suite covers the domain layer, which is where the money is:

- `tests/pricing.test.ts` — tier resolution at bracket boundaries, unsorted
  tiers, gaps, single-tier and untiered products, nudge thresholds, rounding,
  and VAT.
- `tests/cart.test.ts` — quantity normalisation against category min/step,
  mixed-category carts, add/update/remove semantics, immutability.
- `tests/nip.test.ts` — the modulo-11 checksum, including the remainder-of-10
  case that no issued NIP can carry.

Tests live at the repository root rather than inside `storefront/` because they
exercise the domain layer as a unit, independent of the framework hosting it.
Vitest runs them in a plain Node environment with `@` aliased to
`storefront/src`.

## Deployment

- **Storefront** — Vercel, with the project's Root Directory set to
  `storefront`. ISR and route handlers work as-is.
- **Directus** — self-hosted from `docker-compose.yml` behind a reverse proxy
  with TLS. `SECRET`, `ADMIN_PASSWORD` and the database password must be real
  secrets; `CORS_ORIGIN` must be the deployed storefront origin.
- The schema is reproduced from `directus/snapshot.yaml`, not by clicking
  through the admin panel.
