# Directus

The headless CMS and product database. Directus derives its REST and GraphQL
APIs from the PostgreSQL schema, so the data model *is* the API contract — see
[docs/data-model.md](../docs/data-model.md) for the collections and their
relationships.

## Layout

| Path | Purpose |
|---|---|
| `snapshot.yaml` | Declarative schema snapshot: collections, fields, relations. Applying it reproduces the exact data model on a fresh instance. |
| `seed/` | Node script that populates a schema-applied instance with categories, products, price tiers, pages and sample orders over the REST API. |
| `extensions/` | Custom Directus extensions, mounted into the container. Empty for now. |
| `uploads/` | Runtime file storage (git-ignored). Product images live on an external CDN; this holds generated proformas and editorial assets. |

## Schema workflow

The snapshot is the source of truth for the data model, and it is versioned
alongside the code. A clone of this repository therefore reproduces the same
collections, fields and relations — no manual admin-panel clicking, no
undocumented drift between environments.

```bash
# Start the stack
docker compose up -d

# Apply the committed schema to a fresh instance
npm run schema:apply

# After changing the model in the admin panel, write the change back to git
npm run schema:snapshot
```

Both scripts run inside the container, where `./directus` is mounted at
`/directus/schema`. Review the diff from `schema:snapshot` before committing:
it is a schema migration and deserves the same scrutiny as one.

## Access model

- **Public role** — read-only on `categories`, `products`, `price_tiers` and
  published `pages`. The storefront catalogue needs no credentials, which is
  what lets Next.js cache it with ISR.
- **Admin role** — full access, including `orders` and `order_items`.
- **Static token** — a server-only token used by the Next.js route handler that
  creates orders. It is never exposed to the browser.
