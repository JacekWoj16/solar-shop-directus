#!/usr/bin/env node

/**
 * Seeds a schema-applied Directus instance.
 *
 * Run after `npm run schema:apply`:
 *
 *   npm run seed              populate an empty instance
 *   npm run seed -- --reset   wipe the seeded collections first
 *
 * Besides inserting data, this configures access — roles, policies and
 * permissions are data rather than schema, so `directus schema apply` does not
 * bring them along and a schema-only setup would serve 403 to the storefront.
 */

import { existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

import { createClient, createMany } from './lib/client.js';
import { configurePublicAccess, configureStorefrontAccess } from './lib/access.js';
import { buildTiers, categories, imageUrl, products } from './data/catalogue.js';
import { pages } from './data/pages.js';
import { sampleOrders } from './data/orders.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

config({ path: resolve(repoRoot, '.env'), quiet: true });

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? 'http://localhost:8055';
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL ?? 'admin@example.com';
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD ?? 'admin123';

const VAT_RATE = 0.23;

/** Collections in dependency order — children first, so deletes are safe. */
const SEEDED_COLLECTIONS = [
  'order_items',
  'orders',
  'price_tiers',
  'products',
  'categories',
  'pages',
];

const reset = process.argv.includes('--reset');

const log = (message) => console.log(message);
const step = (message) => console.log(`\n${message}`);

/* -------------------------------------------------------------------------
 * Pricing
 *
 * A deliberately small restatement of the tier rule from
 * storefront/src/lib/pricing.ts, so the sample orders carry totals that agree
 * with what the storefront would compute. The authoritative implementation —
 * with its handling of gaps, unsorted rows and untiered products — lives there
 * and is what the test suite covers.
 * ---------------------------------------------------------------------- */

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function unitPriceFor(tiers, quantity) {
  const sorted = [...tiers].sort((a, b) => a.min_quantity - b.min_quantity);
  const containing = sorted.find(
    (tier) =>
      quantity >= tier.min_quantity &&
      (tier.max_quantity === null || quantity <= tier.max_quantity),
  );
  if (containing) return Number(containing.unit_price);

  let applicable = sorted[0];
  for (const tier of sorted) if (tier.min_quantity <= quantity) applicable = tier;
  return Number(applicable.unit_price);
}

/* -------------------------------------------------------------------------
 * Seeding steps
 * ---------------------------------------------------------------------- */

async function countExisting(client) {
  const counts = {};
  for (const collection of SEEDED_COLLECTIONS) {
    const result = await client.get(
      `/items/${collection}?aggregate[count]=id&limit=1`,
    );
    counts[collection] = Number(result?.[0]?.count?.id ?? 0);
  }
  return counts;
}

async function wipe(client) {
  for (const collection of SEEDED_COLLECTIONS) {
    const items = await client.get(`/items/${collection}?fields=id&limit=-1`);
    if (!items?.length) continue;
    await client.delete(`/items/${collection}`, items.map((item) => item.id));
    log(`  cleared ${collection} (${items.length})`);
  }
}

async function seedCatalogue(client) {
  const createdCategories = await createMany(
    client,
    'categories',
    categories.map((category) => ({ ...category, is_active: true })),
  );
  log(`  ${createdCategories.length} categories`);

  const categoryIdBySlug = Object.fromEntries(
    createdCategories.map((category) => [category.slug, category.id]),
  );

  const productRows = [];
  for (const [slug, entries] of Object.entries(products)) {
    entries.forEach(([sku, brand, name, , power_watts, stock_status], index) => {
      productRows.push({
        category: categoryIdBySlug[slug],
        sku,
        name,
        brand,
        description: `${name}. Supplied by ${brand}. Net trade price, VAT added at checkout.`,
        image_url: imageUrl(sku),
        power_watts,
        stock_status,
        is_active: true,
        sort_order: index + 1,
      });
    });
  }

  const createdProducts = await createMany(client, 'products', productRows);
  log(`  ${createdProducts.length} products`);

  const productIdBySku = Object.fromEntries(
    createdProducts.map((product) => [product.sku, product.id]),
  );

  const tierRows = [];
  for (const [slug, entries] of Object.entries(products)) {
    for (const [sku, , , basePrice] of entries) {
      for (const tier of buildTiers(slug, basePrice)) {
        tierRows.push({ ...tier, product: productIdBySku[sku] });
      }
    }
  }

  await createMany(client, 'price_tiers', tierRows);
  log(`  ${tierRows.length} price tiers`);

  return { productIdBySku, categoryIdBySlug };
}

async function seedPages(client) {
  const created = await createMany(client, 'pages', pages);
  log(`  ${created.length} pages`);
}

async function seedOrders(client, productIdBySku) {
  // Re-read the tiers that were just written, so sample totals are derived from
  // the same data the storefront reads rather than from the seed constants.
  const tiers = await client.get(
    '/items/price_tiers?fields=product,min_quantity,max_quantity,unit_price&limit=-1',
  );
  const tiersByProduct = tiers.reduce((map, tier) => {
    (map[tier.product] ??= []).push(tier);
    return map;
  }, {});

  const catalogue = await client.get('/items/products?fields=id,sku,name&limit=-1');
  const productById = Object.fromEntries(catalogue.map((p) => [p.id, p]));

  let orderCount = 0;
  let itemCount = 0;

  for (const order of sampleOrders) {
    const { items, daysAgo, ...fields } = order;

    const lines = items.map(({ sku, quantity }) => {
      const productId = productIdBySku[sku];
      if (!productId) throw new Error(`Sample order references unknown SKU: ${sku}`);

      const product = productById[productId];
      const unitPrice = unitPriceFor(tiersByProduct[productId] ?? [], quantity);

      return {
        product: productId,
        product_name: product.name,
        product_sku: sku,
        quantity,
        unit_price: unitPrice,
        line_total: roundMoney(unitPrice * quantity),
      };
    });

    const subtotalNet = roundMoney(
      lines.reduce((sum, line) => sum + line.line_total, 0),
    );
    const vatAmount = roundMoney(subtotalNet * VAT_RATE);

    const created = await client.post('/items/orders', {
      ...fields,
      subtotal_net: subtotalNet,
      vat_amount: vatAmount,
      total_gross: roundMoney(subtotalNet + vatAmount),
      proforma_path: null,
      date_created: new Date(
        Date.now() - daysAgo * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    await createMany(
      client,
      'order_items',
      lines.map((line) => ({ ...line, order: created.id })),
    );

    orderCount += 1;
    itemCount += lines.length;
    log(
      `  ${fields.order_number}  ${String(fields.status).padEnd(17)} ` +
        `${lines.length} lines  ${subtotalNet.toFixed(2)} PLN net`,
    );
  }

  return { orderCount, itemCount };
}

/**
 * Writes the storefront environment file if it does not exist yet. Overwriting
 * is not on the table — a developer may have real values in there.
 */
function writeStorefrontEnv(token) {
  const envPath = resolve(repoRoot, 'storefront/.env.local');

  if (existsSync(envPath)) return { written: false, path: envPath };

  writeFileSync(
    envPath,
    [
      '# Generated by `npm run seed`. Safe to edit; it is git-ignored.',
      `DIRECTUS_URL=${DIRECTUS_URL}`,
      `NEXT_PUBLIC_DIRECTUS_URL=${DIRECTUS_URL}`,
      `DIRECTUS_STATIC_TOKEN=${token}`,
      'NEXT_PUBLIC_SITE_URL=http://localhost:3000',
      '',
    ].join('\n'),
  );

  return { written: true, path: envPath };
}

/* -------------------------------------------------------------------------
 * Entry point
 * ---------------------------------------------------------------------- */

async function main() {
  const client = createClient({
    url: DIRECTUS_URL,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  step(`Connecting to ${DIRECTUS_URL}`);
  await client.waitUntilReady();
  await client.login();
  log('  authenticated as admin');

  const existing = await countExisting(client);
  const populated = Object.entries(existing).filter(([, count]) => count > 0);

  if (populated.length && !reset) {
    console.error(
      '\nThis instance already contains data:\n' +
        populated.map(([name, count]) => `  ${name}: ${count}`).join('\n') +
        '\n\nRe-run with --reset to replace it:\n  npm run seed -- --reset\n',
    );
    process.exit(1);
  }

  if (populated.length) {
    step('Clearing existing data');
    await wipe(client);
  }

  step('Configuring access');
  await configurePublicAccess(client, log);
  const token = await configureStorefrontAccess(client, log);

  step('Seeding catalogue');
  const { productIdBySku } = await seedCatalogue(client);

  step('Seeding pages');
  await seedPages(client);

  step('Seeding sample orders');
  const { orderCount, itemCount } = await seedOrders(client, productIdBySku);

  const env = writeStorefrontEnv(token);

  step('Done');
  log(`  ${orderCount} orders with ${itemCount} lines`);
  log('');
  log('  Storefront token (server-side only, never expose to the browser):');
  log(`    DIRECTUS_STATIC_TOKEN=${token}`);
  log('');
  if (env.written) {
    log(`  Written to ${env.path}`);
  } else {
    log(`  ${env.path} already exists — update DIRECTUS_STATIC_TOKEN there by hand.`);
  }
  log('');
}

main().catch((error) => {
  console.error(`\nSeed failed: ${error.message}`);
  process.exit(1);
});
