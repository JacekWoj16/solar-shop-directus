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
inputs and the cart never need the server.

The storefront runs with Next 16's `cacheComponents`, which changes where
caching is declared. There is no `export const revalidate` on any route.
Instead **everything is dynamic unless a query marks itself cacheable** with
`use cache`, and each cached query names how long its data stays good:

| Profile | Window | Used for |
|---|---|---|
| `structure` | 1 hour | Categories and editorial pages — the shape of the shop |
| `catalogue` | 30 minutes | Products and price tiers |

That default is the right way round for a shop: a page is never accidentally
stale, only deliberately so, and the one read that decides what a buyer is
charged (`getProductsByIds`, used by the order route) is simply left uncached.

The payoff is that a route no longer has to be entirely static or entirely
dynamic:

| Route | Strategy |
|---|---|
| `/` | Fully prerendered. Every query on it is cacheable. |
| `/products/[category]` | **Partial prerender.** Breadcrumb, heading, description and ordering rules are prerendered per category at build time; the table depends on `?sort` and `?page`, so it streams into a `Suspense` boundary. |
| `/search` | Dynamic — the query space is unbounded, there is nothing to prerender. |
| `/cart`, `/checkout` | Client-side; state lives in `localStorage`. |
| `/order/[orderId]` | Dynamic and uncached — per-order data must never be served from a shared cache. |
| `/api/orders`, `/api/proforma/[orderId]` | Route handlers. |

Two things this arrangement is quietly protecting against:

- **A short cache window on a shared component poisons the whole site.** The
  header renders on every page, so if its category query used the 30-minute
  `catalogue` profile, every page — home included — would revalidate on that
  schedule for data that had not moved. It uses `structure` instead.
- **Reading the clock during a prerender is dynamic.** A `new Date()` in the
  footer's copyright line was enough to make Next refuse to prerender any page
  that renders the footer, which is all of them. It is now a day-lived cached
  read, which keeps the footer static and still rolls the year over on time.

## Pricing

Volume pricing is the core business logic, and it is deliberately concentrated
in one module (`src/lib/pricing.ts`) that everything else calls:

- `resolveTier` is forgiving about imperfect data. Tiers are hand-authored by a
  shop owner in an admin panel, so they will eventually be out of order, have
  gaps, or bound their top bracket. A buyer must always see a price when one can
  be reasonably inferred — the only case that yields "no price" is a product
  with no tiers at all, which the UI renders as *contact for a quote* rather
  than as `0`.
- **Money is rounded at every boundary**, through `roundMoney`. Scaling by 100
  leaves values that are exact in decimal but not in binary just *below* the
  halfway point (`8.165 * 100` is `816.4999999999999`), so a plain `Math.round`
  rounds them down and the shop quietly undercharges. Trimming to 15 significant
  digits first removes the representation error. A `Number.EPSILON` correction
  is not enough — EPSILON is scaled to 1.0 and is already an order of magnitude
  too small at 8 zł.
- **VAT is computed once on the rounded net subtotal**, not per line. That is
  what a Polish invoice does, and it avoids the grosz of drift that per-line VAT
  accumulates across a large order.

**Prices shown to the buyer are never trusted.** The checkout sends only product
ids and quantities; `POST /api/orders` re-reads the tiers from Directus and
recomputes every line server-side. A tampered `localStorage` cart changes what
the buyer sees and nothing else.

## Reading from Directus

`src/lib/api.ts` is the only module that talks to the catalogue, and it exists
for a specific reason beyond tidiness: **PostgreSQL returns `numeric` columns as
strings**. A price arrives as `"346.50"`, not `346.5`, because the driver will
not risk precision loss through a float.

That is a quiet failure mode. String arithmetic coerces and appears to work, so
totals look right in a smoke test — but `Number.isFinite("346.50")` is `false`,
which means every formatted price renders as `0,00 zł`. Everything crossing this
boundary is therefore normalised once, in `normalizeProduct` /
`normalizeCategory`, and the domain layer only ever sees real numbers.
`tests/api.test.ts` pins this against the exact shape the API returns.

Two further details worth knowing about the SDK:

- `fields` takes relations as a **single** nested object. The SDK infers the
  shape of the whole array from its first object entry, so
  `['*', { category }, { price_tiers }]` fails to typecheck while
  `['*', { category, price_tiers }]` succeeds.
- Sorting by price is deliberately *not* pushed to the database. The displayed
  price depends on the buyer's quantity, so "cheapest first" is not a property
  of a row that SQL can order by; price sorts are applied after tier resolution.

## Filtering

Filter state lives in the URL, never in component state. A filtered table is
then a link: "the 600 W+ Trina modules you have in stock" can be bookmarked,
sent to a colleague, or reloaded without losing it, and the back button behaves.
`src/lib/filters.ts` is the only module that knows how that state is spelled,
and it is pure, so parsing and serialising are tested without a router
(`tests/filters.test.ts`).

Three decisions worth stating:

- **Facets are derived from the category, not hard-coded.** Wattage bands are
  computed from the range actually present, so a category of 425–715 W modules
  never offers a "200–250 W" filter that can only return nothing, and inverters
  — which have no wattage — are offered no power filter at all. A range that
  falls entirely within one band offers no bands either: a filter with a single
  option filters nothing.
- **Facets cover the whole category, not the filtered set.** Narrowing them as
  filters are applied would let a buyer tick a box and then be unable to find it
  again to untick it.
- **Wattage bands are a union.** Ticking 400–450 and 600 W+ means "either", the
  only reading that makes sense; the intersection is always empty.

Parsing is deliberately forgiving. A hand-edited or truncated URL drops the
parts it cannot understand and still renders a usable page — a malformed band is
ignored rather than fatal, and a reversed price range is swapped rather than
returning nothing, because it is a typo, not a request for zero results.

Price is the awkward one. A product's price is not a column: it is whichever
bracket the buyer's quantity lands in. So `price_min`/`price_max` cannot go into
SQL — a `price_tiers.unit_price` filter would match any product with *some*
bracket in range rather than one whose list price is — and neither can "cheapest
first". Both are resolved against the entry bracket after the tiers are read,
which means fetching the filtered set and paginating in memory. Every filter SQL
*can* apply (brand, wattage, stock, category) still narrows that set first. At
thousands of SKUs per category this would want a denormalised `entry_price`
column maintained by a Directus flow, so both could go back into the database.

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

## Two operational traps

Both of these were found by running the documented setup from scratch, and both
fail in ways that look like something else:

1. **`schema apply` needs a restart.** The CLI writes the new collections
   straight to the database while the running server keeps its own copy of the
   schema in memory. Until it restarts, every request to a new collection
   answers `403 ... or it does not exist` — *including requests from an
   administrator*, which sends you hunting for a permissions bug that is not
   there. `POST /utils/cache/clear` does not fix it; this is process memory, not
   the cache store. `npm run schema:apply` therefore restarts the container.
2. **`docker compose exec` truncates piped stdout at 64 KiB.** Redirecting a
   snapshot straight to a host file cuts it mid-token and produces YAML that
   fails to parse on the next apply. `npm run schema:snapshot` writes inside the
   container and copies the file out with `docker compose cp` instead.
