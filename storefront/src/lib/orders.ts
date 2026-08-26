import { readItems } from '@directus/sdk';

import type { Order, OrderItem, OrderStatus } from '@/types/order';

import { directusAdmin } from './directus';
import { toNumber } from './api';

/**
 * Order reads.
 *
 * Server-only, and separate from `lib/api.ts` on purpose: the catalogue is
 * public and cacheable, while orders are neither. Every function here goes
 * through the static-token client, so importing this into a client component
 * fails loudly rather than leaking a token.
 *
 * Orders are addressed by UUID and served uncached. Anyone holding the link can
 * see the order — there are no accounts in this shop, so the unguessable URL is
 * the credential, the same arrangement most guest-checkout stores use. A real
 * deployment handling personal data at scale would want a signed, expiring link
 * instead.
 */

function normalizeOrderItem(raw: Record<string, unknown>): OrderItem {
  return {
    id: String(raw.id),
    product: (raw.product as string | null) ?? null,
    product_name: String(raw.product_name ?? ''),
    product_sku: String(raw.product_sku ?? ''),
    quantity: toNumber(raw.quantity, 0),
    // Decimals arrive from PostgreSQL as strings; see lib/api.ts.
    unit_price: toNumber(raw.unit_price),
    line_total: toNumber(raw.line_total),
  };
}

function normalizeOrder(raw: Record<string, unknown>): Order {
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    id: String(raw.id),
    order_number: String(raw.order_number ?? ''),
    status: (raw.status as OrderStatus) ?? 'pending_payment',
    invoice_type: raw.invoice_type === 'nip' ? 'nip' : 'anonymous',
    company_name: (raw.company_name as string | null) ?? null,
    nip: (raw.nip as string | null) ?? null,
    company_address: (raw.company_address as string | null) ?? null,
    delivery_name: String(raw.delivery_name ?? ''),
    delivery_address: String(raw.delivery_address ?? ''),
    delivery_city: String(raw.delivery_city ?? ''),
    delivery_postal_code: String(raw.delivery_postal_code ?? ''),
    delivery_phone: String(raw.delivery_phone ?? ''),
    delivery_email: String(raw.delivery_email ?? ''),
    subtotal_net: toNumber(raw.subtotal_net),
    vat_amount: toNumber(raw.vat_amount),
    total_gross: toNumber(raw.total_gross),
    notes: (raw.notes as string | null) ?? null,
    proforma_path: (raw.proforma_path as string | null) ?? null,
    date_created: String(raw.date_created ?? ''),
    date_updated: (raw.date_updated as string | null) ?? null,
    items: (items as Record<string, unknown>[]).map(normalizeOrderItem),
  };
}

/** One order with its lines, or `null` if the id does not resolve. */
export async function getOrderById(id: string): Promise<Order | null> {
  // A malformed id would otherwise reach Directus as a database error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;

  const data = await directusAdmin().request(
    readItems('orders', {
      fields: ['*', { items: ['*'] }],
      filter: { id: { _eq: id } },
      limit: 1,
    }),
  );

  const [order] = data as Record<string, unknown>[];
  return order ? normalizeOrder(order) : null;
}
