import { aggregate, readItems } from '@directus/sdk';
import { cacheLife, cacheTag } from 'next/cache';

import type { Page } from '@/types/page';
import type {
  CategoryFacets,
  Category,
  PowerBand,
  Product,
  ProductSort,
} from '@/types/product';

import { directusClient } from './directus';
import { PRODUCTS_PER_PAGE } from './constants';
import { buildPowerBands } from './filters';
import { getEntryPrice } from './pricing';

/**
 * Typed catalogue queries.
 *
 * This module is the boundary between Directus and the rest of the app, and it
 * exists for one specific reason beyond tidiness: **PostgreSQL returns `numeric`
 * columns as strings**. `unit_price` arrives as `"346.50"`, not `346.5`, because
 * the driver refuses to risk precision loss through a JavaScript float. Passing
 * that straight into the pricing layer would be quietly wrong — arithmetic would
 * coerce and appear to work, while `Number.isFinite("346.50")` is `false`, so
 * every formatted price would render as `0,00`.
 *
 * Everything crossing this boundary is therefore normalised once, here, and the
 * domain layer only ever sees real numbers.
 *
 * Caching is declared here too, per query, with `use cache`. What gets cached
 * is the normalised result rather than the raw HTTP response, so the parsing is
 * cached along with the data. Order-time reads are deliberately left uncached:
 * a price used to bill someone must be current, not merely recent.
 */

/**
 * Fields every product query needs, including its category and tiers.
 *
 * Relations go in a *single* nested object rather than dotted strings or one
 * object per relation: the SDK infers the shape of the whole `fields` array
 * from its first object entry, so `[{ category }, { price_tiers }]` fails to
 * typecheck while `[{ category, price_tiers }]` succeeds.
 */
const PRODUCT_FIELDS = ['*', { category: ['*'], price_tiers: ['*'] }] as const;

const CATEGORY_FIELDS = ['*'] as const;

const PAGE_FIELDS = ['*'] as const;

/** Tiers must arrive cheapest-quantity first; the pricing layer re-sorts, but
 *  ordering them in the query keeps the admin UI and the API consistent. */
const TIER_DEEP = { price_tiers: { _sort: ['min_quantity'] } } as const;

/* -------------------------------------------------------------------------
 * Normalisation
 * ---------------------------------------------------------------------- */

/** Coerces a Directus numeric (string, number or null) to a number. */
function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/** Coerces a nullable Directus numeric, preserving a genuine `null`. */
function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCategory(raw: Record<string, unknown>): Category {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    slug: String(raw.slug ?? ''),
    description: (raw.description as string | null) ?? null,
    min_quantity: Math.max(1, toNumber(raw.min_quantity, 1)),
    quantity_step: Math.max(1, toNumber(raw.quantity_step, 1)),
    sort_order: toNumber(raw.sort_order, 0),
    is_active: raw.is_active !== false,
  };
}

function normalizeProduct(raw: Record<string, unknown>): Product {
  const tiers = Array.isArray(raw.price_tiers) ? raw.price_tiers : [];

  return {
    id: String(raw.id),
    sku: String(raw.sku ?? ''),
    name: String(raw.name ?? ''),
    brand: String(raw.brand ?? ''),
    description: (raw.description as string | null) ?? null,
    image_url: (raw.image_url as string | null) ?? null,
    power_watts: toNullableNumber(raw.power_watts),
    stock_status: (raw.stock_status as Product['stock_status']) ?? 'out_of_stock',
    is_active: raw.is_active !== false,
    sort_order: toNumber(raw.sort_order, 0),
    date_created: String(raw.date_created ?? ''),
    date_updated: (raw.date_updated as string | null) ?? null,
    category: normalizeCategory(
      (raw.category as Record<string, unknown>) ?? {},
    ),
    price_tiers: tiers.map((tier: Record<string, unknown>) => ({
      id: String(tier.id),
      min_quantity: toNumber(tier.min_quantity, 1),
      max_quantity: toNullableNumber(tier.max_quantity),
      unit_price: toNumber(tier.unit_price),
      sort_order: toNumber(tier.sort_order, 0),
    })),
  };
}

function normalizePage(raw: Record<string, unknown>): Page {
  return {
    id: String(raw.id),
    slug: String(raw.slug ?? ''),
    title: String(raw.title ?? ''),
    content: String(raw.content ?? ''),
    status: raw.status === 'published' ? 'published' : 'draft',
    date_updated: (raw.date_updated as string | null) ?? null,
  };
}

/* -------------------------------------------------------------------------
 * Sorting
 * ---------------------------------------------------------------------- */

/**
 * Directus sort expressions for the table's sort control.
 *
 * Price sorting is intentionally absent: the displayed price depends on the
 * buyer's quantity, so "cheapest first" is not a property of the row that the
 * database can order by. Price sorts are applied after tier resolution, in the
 * table itself.
 */
/** Literal field names, so the SDK can narrow them against the schema. */
type SortField = 'name' | '-name' | 'sku' | 'sort_order';

const SORT_EXPRESSIONS: Record<
  Exclude<ProductSort, 'price_asc' | 'price_desc'>,
  SortField[]
> = {
  name_asc: ['name'],
  name_desc: ['-name'],
  sku_asc: ['sku'],
};

function sortExpression(sort: ProductSort): SortField[] {
  if (sort === 'price_asc' || sort === 'price_desc') {
    return ['sort_order', 'name'];
  }
  return SORT_EXPRESSIONS[sort];
}


/* -------------------------------------------------------------------------
 * Queries
 * ---------------------------------------------------------------------- */

/** Active categories in menu order. */
export async function getCategories(): Promise<Category[]> {
  'use cache';
  cacheLife('structure');
  cacheTag('categories');

  const data = await directusClient().request(
    readItems('categories', {
      fields: [...CATEGORY_FIELDS],
      filter: { is_active: { _eq: true } },
      sort: ['sort_order', 'name'],
      limit: -1,
    }),
  );

  return (data as Record<string, unknown>[]).map(normalizeCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  'use cache';
  cacheLife('structure');
  cacheTag('categories', `category:${slug}`);

  const data = await directusClient().request(
    readItems('categories', {
      fields: [...CATEGORY_FIELDS],
      filter: { slug: { _eq: slug }, is_active: { _eq: true } },
      limit: 1,
    }),
  );

  const [category] = data as Record<string, unknown>[];
  return category ? normalizeCategory(category) : null;
}

export interface ProductPage {
  products: Product[];
  /** Total matching products, for pagination controls. */
  total: number;
  page: number;
  pageCount: number;
}

export interface ProductQuery {
  categorySlug?: string;
  /** Free-text search across name, SKU, description and brand. */
  search?: string;
  brands?: string[];
  /** Wattage bands, combined as a union. */
  power?: PowerBand[];
  /** Bounds on the entry-tier unit price, applied after tier resolution. */
  priceMin?: number | null;
  priceMax?: number | null;
  inStockOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

/** Builds the Directus filter for a product query. */
function buildFilter(query: ProductQuery): Record<string, unknown> {
  const conditions: Record<string, unknown>[] = [{ is_active: { _eq: true } }];

  if (query.categorySlug) {
    conditions.push({ category: { slug: { _eq: query.categorySlug } } });
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    conditions.push({
      _or: [
        { name: { _icontains: term } },
        { sku: { _icontains: term } },
        { brand: { _icontains: term } },
        { description: { _icontains: term } },
      ],
    });
  }

  if (query.brands?.length) {
    conditions.push({ brand: { _in: query.brands } });
  }

  // Wattage bands are a union: ticking two bands widens the result, it does
  // not narrow it to their (empty) intersection.
  if (query.power?.length) {
    conditions.push({
      _or: query.power.map((band) =>
        band.max === null
          ? { power_watts: { _gte: band.min } }
          : { _and: [
              { power_watts: { _gte: band.min } },
              { power_watts: { _lt: band.max } },
            ] },
      ),
    });
  }

  if (query.inStockOnly) {
    conditions.push({ stock_status: { _in: ['in_stock', 'low_stock'] } });
  }

  return { _and: conditions };
}

/**
 * A page of products, cached on the `catalogue` profile.
 *
 * For category browsing, where the set of queries is small and bounded by the
 * category list and its facets. Search uses `searchProducts` instead.
 */
export async function getProducts(query: ProductQuery = {}): Promise<ProductPage> {
  'use cache';
  cacheLife('catalogue');
  cacheTag('products');

  return fetchProducts(query);
}

/**
 * The same query, deliberately uncached.
 *
 * Free-text search has an unbounded query space: every distinct string a
 * visitor types would become its own cache entry, evicting entries that are
 * actually reused. The catalogue read behind it is cheap, and the page is
 * server-rendered per request anyway.
 */
export async function searchProducts(query: ProductQuery): Promise<ProductPage> {
  return fetchProducts(query);
}

async function fetchProducts(query: ProductQuery = {}): Promise<ProductPage> {
  const pageSize = query.pageSize ?? PRODUCTS_PER_PAGE;
  const page = Math.max(1, query.page ?? 1);
  const filter = buildFilter(query);
  const client = directusClient();

  const sort = query.sort ?? 'name_asc';

  // Anything that depends on the resolved price — sorting by it or bounding it —
  // has to be settled after the tiers are read, not in SQL. See below.
  const priceBounded = query.priceMin != null || query.priceMax != null;
  if (sort === 'price_asc' || sort === 'price_desc' || priceBounded) {
    return getProductsByPrice({ ...query, sort, page, pageSize }, filter);
  }

  const [data, countResult] = await Promise.all([
    client.request(
      readItems('products', {
        fields: [...PRODUCT_FIELDS],
        deep: TIER_DEEP,
        filter,
        sort: sortExpression(sort),
        limit: pageSize,
        page,
      }),
    ),
    client.request(
      aggregate('products', { aggregate: { count: '*' }, query: { filter } }),
    ),
  ]);

  const total = toNumber(
    (countResult as Array<{ count: string | number | null }>)[0]?.count,
    0,
  );

  return {
    products: (data as Record<string, unknown>[]).map(normalizeProduct),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Ordering for the in-memory path, matching what the database would have done
 * for the non-price sorts so a price *filter* does not silently reorder a
 * name-sorted table.
 */
function comparator(sort: ProductSort): (a: Product, b: Product) => number {
  if (sort === 'sku_asc') return (a, b) => a.sku.localeCompare(b.sku);
  if (sort === 'name_desc') return (a, b) => b.name.localeCompare(a.name);
  if (sort !== 'price_asc' && sort !== 'price_desc') {
    return (a, b) => a.name.localeCompare(b.name);
  }

  const direction = sort === 'price_asc' ? 1 : -1;

  return (a, b) => {
    // Quoted-on-request products have no price to rank; they sort last in both
    // directions rather than pretending to cost nothing.
    const priceA = getEntryPrice(a.price_tiers);
    const priceB = getEntryPrice(b.price_tiers);
    if (priceA === null && priceB === null) return a.name.localeCompare(b.name);
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return (priceA - priceB) * direction || a.name.localeCompare(b.name);
  };
}

/**
 * Price-sorted and/or price-bounded page.
 *
 * Neither can be pushed into SQL. A product's price is not a column: it is
 * whichever bracket the buyer's quantity lands in, so "cheapest first" is not a
 * property of a row, and "between 250 and 300 zł" would match any product with
 * *some* bracket in that range rather than one whose list price is. Both are
 * therefore resolved against the entry bracket after the tiers are read, which
 * means fetching the whole filtered set and paginating in memory.
 *
 * That is fine at this catalogue's size (the largest category is under thirty
 * products) and is still narrowed by every filter SQL *can* apply — brand,
 * wattage, stock. A catalogue with thousands of SKUs per category would want a
 * denormalised `entry_price` column on `products`, maintained by a Directus
 * flow, so both could go back into the database.
 */
async function getProductsByPrice(
  query: ProductQuery & { sort: ProductSort; page: number; pageSize: number },
  filter: Record<string, unknown>,
): Promise<ProductPage> {
  const data = await directusClient().request(
    readItems('products', {
      fields: [...PRODUCT_FIELDS],
      deep: TIER_DEEP,
      sort: ['name'],
      limit: -1,
      filter,
    }),
  );

  let products = (data as Record<string, unknown>[]).map(normalizeProduct);

  if (query.priceMin != null || query.priceMax != null) {
    products = products.filter((product) => {
      const price = getEntryPrice(product.price_tiers);
      // Quoted-on-request products have no price to compare against, so a price
      // filter necessarily excludes them.
      if (price === null) return false;
      if (query.priceMin != null && price < query.priceMin) return false;
      if (query.priceMax != null && price > query.priceMax) return false;
      return true;
    });
  }

  products.sort(comparator(query.sort));

  const total = products.length;
  const start = (query.page - 1) * query.pageSize;

  return {
    products: products.slice(start, start + query.pageSize),
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

/**
 * The filter options a category actually offers.
 *
 * Derived from the category's own products rather than hard-coded, so a
 * category never presents a filter that can only return nothing — no "200–250 W"
 * band in a range that starts at 425 W, no brand that stocks nothing here.
 *
 * Facets are computed over the *whole* category, not the currently filtered
 * set. Narrowing them as filters are applied would let a buyer tick a box and
 * then be unable to find it again to untick it.
 */
export async function getCategoryFacets(
  categorySlug?: string,
): Promise<CategoryFacets> {
  'use cache';
  cacheLife('catalogue');
  cacheTag('products');

  return fetchFacets({ categorySlug });
}

/** Facets over a search result set. Uncached, for the same reason as above. */
export async function getSearchFacets(search: string): Promise<CategoryFacets> {
  return fetchFacets({ search });
}

async function fetchFacets(query: ProductQuery): Promise<CategoryFacets> {
  // Reuses the standard product shape and normaliser rather than a leaner
  // projection: the query is cached, a category is at most a few dozen rows,
  // and reading facets off normalised products means prices here are parsed by
  // exactly the same code that parses them for the table.
  const data = await directusClient().request(
    readItems('products', {
      fields: [...PRODUCT_FIELDS],
      deep: TIER_DEEP,
      filter: buildFilter(query),
      sort: ['brand'],
      limit: -1,
    }),
  );

  const products = (data as Record<string, unknown>[]).map(normalizeProduct);

  const brandCounts = new Map<string, number>();
  // Which categories the matches fall into, and how many in each. Only useful
  // for search, where results span the catalogue.
  const categoryCounts = new Map<string, { name: string; count: number }>();
  const wattages: number[] = [];
  const prices: number[] = [];

  for (const product of products) {
    if (product.brand) {
      brandCounts.set(product.brand, (brandCounts.get(product.brand) ?? 0) + 1);
    }
    if (product.category?.slug) {
      const entry = categoryCounts.get(product.category.slug);
      categoryCounts.set(product.category.slug, {
        name: product.category.name,
        count: (entry?.count ?? 0) + 1,
      });
    }
    if (product.power_watts !== null) wattages.push(product.power_watts);

    const entry = getEntryPrice(product.price_tiers);
    if (entry !== null) prices.push(entry);
  }

  return {
    brands: [...brandCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    categories: [...categoryCounts.entries()]
      .map(([slug, { name, count }]) => ({ slug, name, count }))
      // Most matches first: the category a searcher wants is usually the one
      // with the most hits.
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    powerBands: wattages.length
      ? buildPowerBands(Math.min(...wattages), Math.max(...wattages))
      : [],
    priceMin: prices.length ? Math.floor(Math.min(...prices)) : null,
    priceMax: prices.length ? Math.ceil(Math.max(...prices)) : null,
  };
}

export async function getProductBySku(sku: string): Promise<Product | null> {
  'use cache';
  cacheLife('catalogue');
  cacheTag('products', `product:${sku}`);

  const data = await directusClient().request(
    readItems('products', {
      fields: [...PRODUCT_FIELDS],
      deep: TIER_DEEP,
      filter: { sku: { _eq: sku }, is_active: { _eq: true } },
      limit: 1,
    }),
  );

  const [product] = data as Record<string, unknown>[];
  return product ? normalizeProduct(product) : null;
}

/**
 * Products by id, used by the order route to re-price a submitted cart.
 *
 * Deliberately **not** cached: this is the read that decides what a buyer is
 * charged, and it must see the current price list rather than one that was
 * accurate half an hour ago.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];

  const data = await directusClient().request(
    readItems('products', {
      fields: [...PRODUCT_FIELDS],
      deep: TIER_DEEP,
      filter: { id: { _in: ids }, is_active: { _eq: true } },
      limit: ids.length,
    }),
  );

  return (data as Record<string, unknown>[]).map(normalizeProduct);
}

export async function getPage(slug: string): Promise<Page | null> {
  'use cache';
  cacheLife('structure');
  cacheTag('pages', `page:${slug}`);

  const data = await directusClient().request(
    readItems('pages', {
      fields: [...PAGE_FIELDS],
      filter: { slug: { _eq: slug }, status: { _eq: 'published' } },
      limit: 1,
    }),
  );

  const [page] = data as Record<string, unknown>[];
  return page ? normalizePage(page) : null;
}

export { normalizeCategory, normalizeProduct, toNullableNumber, toNumber };
