import { createItem, readItems } from '@directus/sdk';
import { NextResponse } from 'next/server';

import { getProductsByIds } from '@/lib/api';
import { getQuantityRules, normalizeQuantity } from '@/lib/cart';
import { EMPTY_CHECKOUT, normalizeCheckout, validateCheckout } from '@/lib/checkout';
import { VAT_RATE } from '@/lib/constants';
import { directusAdmin } from '@/lib/directus';
import { roundMoney } from '@/lib/format';
import { nextOrderNumber, orderNumberPrefix } from '@/lib/order-number';
import { getUnitPrice } from '@/lib/pricing';
import type { CheckoutInput } from '@/lib/checkout';
import type { OrderLineInput } from '@/types/order';

/**
 * Order intake.
 *
 * The security-relevant part of the whole storefront, and it rests on one rule:
 * **the request body contributes identifiers and quantities, never prices.**
 * Unit prices are re-read from Directus and the tiers re-resolved here, so a
 * cart edited in devtools changes what that buyer sees and nothing that gets
 * billed. Quantities are re-normalised against each product's category rules
 * for the same reason.
 */

/** A single order cannot plausibly need more distinct products than this. */
const MAX_LINES = 200;

/**
 * Whether a Directus error is a unique-constraint violation.
 *
 * Inspected structurally rather than by stringifying: `JSON.stringify` on an
 * `Error` returns `"{}"`, because its own properties are non-enumerable — so a
 * substring check against the serialised error silently never matches, and the
 * retry it guards never runs.
 */
function isUniqueViolation(error: unknown): boolean {
  const errors = (error as {
    errors?: Array<{ message?: string; extensions?: { code?: string } }>;
  })?.errors;

  return Boolean(
    errors?.some(
      (entry) =>
        entry.extensions?.code === 'RECORD_NOT_UNIQUE' ||
        /has to be unique/i.test(entry.message ?? ''),
    ),
  );
}

interface RequestBody extends Partial<CheckoutInput> {
  items?: unknown;
}

function parseLines(value: unknown): OrderLineInput[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((line): line is Record<string, unknown> => typeof line === 'object' && line !== null)
    .map((line) => ({
      productId: String(line.productId ?? ''),
      quantity: Number(line.quantity),
    }))
    .filter((line) => line.productId !== '' && Number.isFinite(line.quantity));
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ message: 'Malformed request body.' }, { status: 400 });
  }

  // --- Validate the buyer's details ---------------------------------------
  const input: CheckoutInput = { ...EMPTY_CHECKOUT, ...body };
  const fieldErrors = validateCheckout(input);

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { message: 'Please correct the highlighted fields.', fields: fieldErrors },
      { status: 422 },
    );
  }

  // --- Validate the lines --------------------------------------------------
  const submitted = parseLines(body.items);

  if (submitted.length === 0) {
    return NextResponse.json({ message: 'Your cart is empty.' }, { status: 422 });
  }
  if (submitted.length > MAX_LINES) {
    return NextResponse.json(
      { message: `An order cannot contain more than ${MAX_LINES} products.` },
      { status: 422 },
    );
  }

  // Collapse duplicate ids rather than writing two lines for one product.
  const quantities = new Map<string, number>();
  for (const line of submitted) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }

  // --- Re-read the catalogue, uncached ------------------------------------
  const products = await getProductsByIds([...quantities.keys()]);
  const byId = new Map(products.map((product) => [product.id, product]));

  const missing = [...quantities.keys()].filter((id) => !byId.has(id));
  if (missing.length > 0) {
    return NextResponse.json(
      {
        message:
          'Some products are no longer available. Please review your cart and try again.',
        fields: { items: missing.join(', ') },
      },
      { status: 409 },
    );
  }

  // --- Price the order -----------------------------------------------------
  const lines = [];

  for (const [productId, requested] of quantities) {
    const product = byId.get(productId)!;
    const quantity = normalizeQuantity(requested, getQuantityRules(product));
    const unitPrice = getUnitPrice(product.price_tiers, quantity);

    if (unitPrice === null) {
      return NextResponse.json(
        {
          message: `${product.name} is quoted on request and cannot be ordered online.`,
        },
        { status: 409 },
      );
    }

    if (product.stock_status === 'out_of_stock') {
      return NextResponse.json(
        { message: `${product.name} is out of stock. Please remove it from your cart.` },
        { status: 409 },
      );
    }

    lines.push({
      product: product.id,
      product_name: product.name,
      product_sku: product.sku,
      quantity,
      unit_price: unitPrice,
      line_total: roundMoney(unitPrice * quantity),
    });
  }

  const subtotalNet = roundMoney(lines.reduce((sum, line) => sum + line.line_total, 0));
  const vatAmount = roundMoney(subtotalNet * VAT_RATE);
  const totalGross = roundMoney(subtotalNet + vatAmount);

  // --- Write it ------------------------------------------------------------
  const admin = directusAdmin();
  const year = new Date().getFullYear();

  // Two attempts: the sequence is derived from the highest number already
  // issued, so two simultaneous orders can pick the same one. The unique
  // constraint catches that, and the retry re-reads and takes the next.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // Read through the admin client, not the anonymous one: the public role
    // deliberately has no access to `orders`, so an anonymous read here answers
    // 403 and takes the whole checkout down with it.
    const existing = (await admin.request(
      readItems('orders', {
        fields: ['order_number'],
        filter: { order_number: { _starts_with: orderNumberPrefix(year) } },
        limit: -1,
      }),
    )) as Array<{ order_number: string }>;

    const orderNumber = nextOrderNumber(
      existing.map((order) => order.order_number),
      year,
    );

    try {
      // Written as one nested create so an order can never exist without its
      // lines — Directus has no REST transaction to fall back on.
      const created = (await admin.request(
        createItem('orders', {
          ...normalizeCheckout(input),
          order_number: orderNumber,
          status: 'pending_payment',
          subtotal_net: subtotalNet,
          vat_amount: vatAmount,
          total_gross: totalGross,
          proforma_path: null,
          items: lines,
        } as never),
      )) as { id: string; order_number: string };

      return NextResponse.json(
        {
          orderId: created.id,
          orderNumber: created.order_number ?? orderNumber,
          totalGross,
        },
        { status: 201 },
      );
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 2) throw error;
    }
  }

  return NextResponse.json(
    { message: 'Could not allocate an order number. Please try again.' },
    { status: 503 },
  );
}
