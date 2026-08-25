/**
 * Order domain types.
 *
 * Orders are written to Directus by a Next.js route handler using a
 * server-only static token; the browser never talks to Directus directly for
 * writes. Payment is always a manual bank transfer against a generated
 * proforma invoice, so there is no payment-provider state to model.
 */

export type OrderStatus =
  | 'pending_payment'
  | 'payment_confirmed'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'payment_confirmed',
  'shipped',
  'completed',
  'cancelled',
] as const;

/**
 * `anonymous` — "faktura bezimienna", issued without buyer identification.
 * `nip`       — issued to a company, requires a valid Polish tax ID.
 */
export type InvoiceType = 'anonymous' | 'nip';

/** Always required, regardless of invoice type. */
export interface DeliveryAddress {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
}

/** Required only when `invoiceType === 'nip'`. */
export interface CompanyDetails {
  companyName: string;
  /** Ten digits; may be submitted formatted (123-456-32-18). */
  nip: string;
  address: string;
}

export interface OrderItem {
  id: string;
  /** `null` if the product was deleted after the order was placed. */
  product: string | null;
  /** Snapshots — an order must stay readable even if the catalogue changes. */
  product_name: string;
  product_sku: string;
  quantity: number;
  /** Net unit price of the tier that applied at checkout. */
  unit_price: number;
  line_total: number;
}

export interface Order {
  id: string;
  /** Human-facing reference, also used as the bank transfer title: SO-2026-00001. */
  order_number: string;
  status: OrderStatus;
  invoice_type: InvoiceType;
  company_name: string | null;
  nip: string | null;
  company_address: string | null;
  delivery_name: string;
  delivery_address: string;
  delivery_city: string;
  delivery_postal_code: string;
  delivery_phone: string;
  delivery_email: string;
  subtotal_net: number;
  vat_amount: number;
  total_gross: number;
  notes: string | null;
  proforma_path: string | null;
  date_created: string;
  date_updated: string | null;
  items: OrderItem[];
}

/** What the checkout form sends to `POST /api/orders`. */
export interface CreateOrderPayload {
  invoiceType: InvoiceType;
  company: CompanyDetails | null;
  delivery: DeliveryAddress;
  notes: string | null;
  /**
   * Only product ids and quantities: unit prices are recomputed server-side
   * from Directus so a tampered cart cannot set its own prices.
   */
  items: Array<{ productId: string; quantity: number }>;
  consent: boolean;
}

export interface CreateOrderResult {
  orderNumber: string;
  orderId: string;
  totalGross: number;
}
