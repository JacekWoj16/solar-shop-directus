# Headless Solar Shop

A B2B e-commerce store for photovoltaic equipment, built as a headless
architecture: **Directus 11** as the CMS and product database, **Next.js 16** as
the storefront.

It is a clean rebuild of a real WooCommerce shop I previously worked on — the
kind that grew into a dozen plugins stitched together to express one idea:
*installers buy by the pallet, and the price depends on how many pallets.*

## What makes it not a generic shop

**Product tables, not product grids.** The core UI is a dense table with an
inline quantity field on every row. A buyer ordering forty pallets wants forty
rows on screen, not forty cards to scroll past. This is a procurement tool, not
a consumer storefront.

**Volume pricing that responds as you type.** Every product carries quantity
brackets (1–4, 5–99, 100–499, 500+). The unit price updates live in the table
and the cart, and when a buyer is a few units short of a cheaper bracket the
cart says so: *"Add 2 more and pay 5% less per unit."*

**Filters that fit the category.** Wattage bands are computed from the modules
actually stocked, so no filter is offered that can only return nothing, and
inverters get no power filter at all. Filter state lives in the URL, so a
narrowed table is a link you can send to a colleague.

**Quantity rules per category.** Panels ship on pallets of five, so the minimum
is 5 and the step is 1. Cables are sold on 10-metre rolls. The rules live on the
category and are enforced in the input, in the cart store and again in the order
route.

**Proforma invoices instead of a payment gateway.** The only payment method is a
manual bank transfer. Placing an order generates a proforma PDF with the bank
details, a payment reference and a seven-day deadline; the shop owner confirms
the transfer in Directus and ships.

**A versioned schema.** `directus/snapshot.yaml` is the data model. Clone,
`docker compose up`, apply the snapshot, and you have the same collections,
fields and relations — not a wiki page describing what to click.

## Screenshots

<!-- Added as the storefront surfaces are built: home, category table with the
     tier tooltip open, search, cart with the nudge, checkout, proforma PDF. -->

_Coming as the storefront is built out._

## Tech stack

| Choice | Why |
|---|---|
| **Directus 11** | Database-first headless CMS: it derives REST and GraphQL from the SQL schema, which suits deeply relational product data (a product owns its price brackets) better than a document CMS. The admin panel manages products, tiers and orders out of the box. Third headless CMS in my portfolio, after Strapi and Payload. |
| **Next.js 16, App Router** | Server components for the catalogue, client components only where interaction demands it, and a rendering strategy per route — see below. |
| **Partial prerendering** | A B2B catalogue changes slowly: prices weekly, stock daily. Pages are prerendered and revalidated on a timer, so the CMS stays out of the request path — and where one part of a page varies (a sorted, paged table), only that part is dynamic while the rest is still served as static HTML. |
| **Zustand + localStorage** | Orders are placed without registration, so a server cart would add a session store, a merge strategy and a cleanup job while buying nothing. |
| **Tailwind CSS v4** | Design tokens declared once in CSS under `@theme`, named semantically. A palette change is a one-file edit. |
| **@react-pdf/renderer** | Proforma generation in a route handler, with the layout expressed as components rather than imperative drawing calls. |
| **PostgreSQL 16** | Directus manages its own schema; Postgres handles the relational load. |

### Rendering strategy

| Route | Strategy |
|---|---|
| `/` | Fully prerendered, 1 hour |
| `/products/[category]` | Static shell prerendered per category; the table streams in, 30 minutes |
| `/search` | Dynamic — the query space is unbounded |
| `/cart` | Prerendered shell with a client island; cart state in `localStorage` |
| `/checkout` | Client-side, `localStorage` |
| `/order/[orderId]` | Dynamic, uncached |

Caching is declared on the queries themselves rather than on route segments:
everything is dynamic unless it opts in, and the read that decides what a buyer
is charged never opts in. Full reasoning in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Getting started

**Prerequisites:** Node.js 22+, Docker with Compose.

```bash
git clone https://github.com/JacekWoj16/solar-shop-directus.git
cd solar-shop-directus
npm install

# 1. Start Directus + PostgreSQL (first run takes ~30s to bootstrap)
docker compose up -d

# 2. Apply the committed schema (restarts Directus so it picks the new
#    collections up — see docs/ARCHITECTURE.md for why that is required)
npm run schema:apply

# 3. Seed the catalogue, configure public read access and issue the
#    storefront's order-intake token. Also writes storefront/.env.local.
npm run seed

# 4. Run it
npm run dev
```

That gives you 7 categories, 74 products with 219 price brackets, 3 editorial
pages and 5 sample orders across the status flow.

| Service | URL | Credentials |
|---|---|---|
| Storefront | http://localhost:3000 | — |
| Directus admin | http://localhost:8055 | `admin@example.com` / `admin123` |

`npm run seed` also sets up access, because roles and permissions are *data* in
Directus rather than schema and `schema apply` does not carry them: it grants
the public role read-only access to the catalogue, then creates a dedicated
`Storefront` machine account whose static token may create orders but cannot
touch the price list. That token is written to `storefront/.env.local` (never
committed, never exposed to the browser).

To reseed a populated instance, pass `--reset`:

```bash
npm run seed -- --reset
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Storefront in development mode |
| `npm run build` | Production build |
| `npm test` | Domain test suite (Vitest) |
| `npm run typecheck` | TypeScript across the repo |
| `npm run lint` | ESLint |
| `npm run directus:up` / `:down` / `:logs` | Docker stack |
| `npm run seed` | Populate the catalogue and configure access (`-- --reset` to replace existing data) |
| `npm run schema:apply` | Apply `directus/snapshot.yaml`, then restart Directus |
| `npm run schema:snapshot` | Write the live schema back to `directus/snapshot.yaml` |

## Tests

```bash
npm test
```

The suite covers the domain layer, which is where the money is: tier resolution
at bracket boundaries, unsorted and gapped tiers, products with no tiers,
nudge thresholds, monetary rounding, VAT, quantity normalisation against
category min/step, and the Polish NIP modulo-11 checksum.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, rendering strategy,
  pricing and cart design, security boundaries
- [docs/data-model.md](docs/data-model.md) — collections, relations, permissions
- [directus/README.md](directus/README.md) — schema workflow

## Deployment

- **Storefront** → Vercel, with Root Directory set to `storefront`.
- **Directus** → self-hosted from `docker-compose.yml` behind a TLS reverse
  proxy. Replace `SECRET`, `ADMIN_PASSWORD` and the database password with real
  secrets, and point `CORS_ORIGIN` at the deployed storefront.

## Project status

Built in stages; this section tracks where it is.

- [x] Architecture, tooling, design tokens, domain layer with tests
- [x] Directus schema snapshot, seed data and access configuration
- [x] Typed catalogue API with tier-aware queries
- [x] Site header, category mega-menu, search box, cart badge
- [x] Product table with live tiered pricing and quantity rules
- [x] Category pages with sorting and pagination
- [x] Product filters — brand, wattage bands, price range, in-stock
- [x] Cart with live tier repricing and volume nudges
- [ ] Search
- [ ] Cart with tier nudges
- [ ] Checkout, NIP validation, order creation
- [ ] Proforma PDF generation
- [ ] Screenshots

## Notes

The shop is fictional. Seller details, bank account and company data on the
proforma are placeholders; product imagery is generated. Brand names in the seed
data are real manufacturers, used to make the catalogue realistic.

## License

[MIT](LICENSE)
