import { aggregate, readItems } from '@directus/sdk';

import type { Page } from '@/types/page';
import type { Category, Product, ProductSort } from '@/types/product';

import { directusClient } from './directus';
import { PRODUCTS_PER_PAGE } from './constants';

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
export async function getCategories(revalidate?: number): Promise<Category[]> {
  const data = await directusClient(revalidate).request(
    readItems('categories', {
      fields: [...CATEGORY_FIELDS],
      filter: { is_active: { _eq: true } },
      sort: ['sort_order', 'name'],
      limit: -1,
    }),
  );

  return (data as Record<string, unknown>[]).map(normalizeCategory);
}

export async function getCategoryBySlug(
  slug: string,
  revalidate?: number,
): Promise<Category | null> {
  const data = await directusClient(revalidate).request(
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
  powerMin?: number | null;
  powerMax?: number | null;
  inStockOnly?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
  revalidate?: number;
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

  if (query.powerMin != null) {
    conditions.push({ power_watts: { _gte: query.powerMin } });
  }
  if (query.powerMax != null) {
    conditions.push({ power_watts: { _lte: query.powerMax } });
  }

  if (query.inStockOnly) {
    conditions.push({ stock_status: { _in: ['in_stock', 'low_stock'] } });
  }

  return { _and: conditions };
}

/** A page of products, with the total needed to render pagination. */
export async function getProducts(query: ProductQuery = {}): Promise<ProductPage> {
  const pageSize = query.pageSize ?? PRODUCTS_PER_PAGE;
  const page = Math.max(1, query.page ?? 1);
  const filter = buildFilter(query);
  const client = directusClient(query.revalidate);

  const [data, countResult] = await Promise.all([
    client.request(
      readItems('products', {
        fields: [...PRODUCT_FIELDS],
        deep: TIER_DEEP,
        filter,
        sort: sortExpression(query.sort ?? 'name_asc'),
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

/** Distinct brands present in a category, for the filter facet. */
export async function getBrands(
  categorySlug?: string,
  revalidate?: number,
): Promise<string[]> {
  const data = await directusClient(revalidate).request(
    readItems('products', {
      fields: ['brand'],
      filter: buildFilter({ categorySlug }),
      sort: ['brand'],
      limit: -1,
    }),
  );

  const brands = (data as Array<{ brand?: string }>)
    .map((row) => row.brand)
    .filter((brand): brand is string => Boolean(brand));

  return [...new Set(brands)];
}

export async function getProductBySku(
  sku: string,
  revalidate?: number,
): Promise<Product | null> {
  const data = await directusClient(revalidate).request(
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

/** Products by id, used by the order route to re-price a submitted cart. */
export async function getProductsByIds(
  ids: string[],
  revalidate = 0,
): Promise<Product[]> {
  if (ids.length === 0) return [];

  const data = await directusClient(revalidate).request(
    readItems('products', {
      fields: [...PRODUCT_FIELDS],
      deep: TIER_DEEP,
      filter: { id: { _in: ids }, is_active: { _eq: true } },
      limit: ids.length,
    }),
  );

  return (data as Record<string, unknown>[]).map(normalizeProduct);
}

export async function getPage(
  slug: string,
  revalidate?: number,
): Promise<Page | null> {
  const data = await directusClient(revalidate).request(
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
