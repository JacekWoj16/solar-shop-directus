# Data model

Six collections in Directus. The schema is versioned as
[`directus/snapshot.yaml`](../directus/snapshot.yaml) and applied with
`npm run schema:apply`, so a fresh clone reproduces this model exactly.

```
categories ──1:N──▶ products ──1:N──▶ price_tiers
                        ▲
                        │ N:1 (snapshot + reference)
                        │
orders ────1:N────▶ order_items

pages   (standalone editorial content)
```

## Naming convention

Many-to-one fields are named after the **relation**, not the key: `category`,
not `category_id`. Directus returns a bare foreign key when the field is not
expanded and the full related object when it is, so `product.category.name`
reads correctly in both the API and the TypeScript types, while
`product.category_id.name` would not.

Monetary columns are `decimal`, never float, and hold **net** values in PLN.
VAT is applied once at the order level.

## `categories`

Product groups. Order rules live here rather than on the product because they
are a commercial policy of the whole group.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | string | "Solar Panels" |
| `slug` | string, unique | Used in `/products/[category]`; drives `generateStaticParams`. |
| `description` | text | Rendered above the product table. |
| `min_quantity` | integer, default 1 | Smallest orderable quantity. Panels: 5. |
| `quantity_step` | integer, default 1 | Increment above the minimum. Cables sold on rolls use 10. |
| `sort_order` | integer | Menu and grid order. |
| `is_active` | boolean, default true | Inactive categories disappear from the storefront without being deleted. |

## `products`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `category` | M2O → `categories` | Supplies the quantity rules. |
| `sku` | string, unique | "PNL-MONO-455". Searchable, shown in mono type. |
| `name` | string | |
| `brand` | string | Manufacturer; drives the brand filter facet. |
| `description` | text | |
| `image_url` | string | **Absolute URL on an external CDN**, not a Directus upload — this mirrors the original shop, keeps the CMS database small, and is why `next.config.ts` allow-lists remote image hosts. |
| `power_watts` | integer, nullable | Panel wattage. `null` for every other category; drives the power-range filter. |
| `stock_status` | string | `in_stock` \| `low_stock` \| `out_of_stock`. A status rather than a count: the shop quotes availability, not exact inventory. |
| `is_active` | boolean, default true | |
| `sort_order` | integer | |
| `date_created` / `date_updated` | timestamp | Directus-managed. |

## `price_tiers`

Volume pricing. One row per quantity bracket per product; the storefront reads
them expanded with the product.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `product` | M2O → `products` | |
| `min_quantity` | integer | First quantity in the bracket, inclusive. |
| `max_quantity` | integer, nullable | Last quantity, inclusive. **`null` marks the open-ended top bracket** ("500+"). |
| `unit_price` | decimal(10,2) | Net PLN for quantities inside the bracket. |
| `sort_order` | integer | Display order in the tier table. |

Typical shapes in the seed data:

| Category | Brackets |
|---|---|
| Solar Panels | 1–4, 5–99, 100–499, 500+ |
| Inverters | 1–2, 3–9, 10+ |
| Cables, Accessories | 1–49, 50+ |

Tier resolution — including gaps, unsorted rows and products with no tiers at
all — is specified in [`src/lib/pricing.ts`](../storefront/src/lib/pricing.ts)
and covered by `tests/pricing.test.ts`.

## `orders`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | Also the URL of the confirmation page. |
| `order_number` | string, unique | `SO-2026-00001`. Doubles as the bank transfer reference. |
| `status` | string | `pending_payment` → `payment_confirmed` → `shipped` → `completed`, plus `cancelled`. Advanced manually by the shop owner in Directus after the transfer lands. |
| `invoice_type` | string | `anonymous` (faktura bezimienna) \| `nip`. |
| `company_name`, `nip`, `company_address` | nullable | Required only when `invoice_type = 'nip'`; the NIP is stored normalised to ten digits. |
| `delivery_name`, `delivery_address`, `delivery_city`, `delivery_postal_code`, `delivery_phone`, `delivery_email` | string / text | Always required. |
| `subtotal_net` | decimal(12,2) | Sum of line totals. **Recomputed server-side**, never taken from the client. |
| `vat_amount` | decimal(12,2) | 23% of `subtotal_net`, rounded once. |
| `total_gross` | decimal(12,2) | |
| `notes` | text, nullable | Buyer notes. |
| `proforma_path` | string, nullable | Reserved for archiving issued proformas. Stays null: the PDF is generated on request from the order itself, so there is no file to point at. |
| `date_created` / `date_updated` | timestamp | |

## `order_items`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `order` | M2O → `orders` | |
| `product` | M2O → `products`, nullable | Nullable **on purpose**: a discontinued product must not delete order history. |
| `product_name` | string | Snapshot at time of order. |
| `product_sku` | string | Snapshot. |
| `quantity` | integer | |
| `unit_price` | decimal(10,2) | The tier price that applied at checkout, frozen. |
| `line_total` | decimal(12,2) | |

The name, SKU and price are **denormalised on purpose**. An order is a
commercial record: it must render identically in three years, after the
catalogue has been repriced and the product retired.

## `pages`

Editorial content for `/about`, `/contact` and `/terms`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `slug` | string, unique | `about`, `contact`, `terms`. |
| `title` | string | |
| `content` | WYSIWYG (HTML) | |
| `status` | string | `published` \| `draft`. Only published pages are readable by the public role. |

## Permissions

| Role | Collections | Access |
|---|---|---|
| Public | `categories`, `products`, `price_tiers` | Read where `is_active = true` |
| Public | `pages` | Read where `status = 'published'` |
| Public | `orders`, `order_items` | **None** |
| Static token (server) | `orders`, `order_items` | Create; read own |
| Admin | all | Full |

Anonymous read access to the catalogue is what allows the storefront to be
statically generated and cached. Orders are write-only from the application's
perspective — reading them back is an admin operation.
