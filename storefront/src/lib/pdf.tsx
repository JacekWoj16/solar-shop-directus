import { join } from 'node:path';

import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';

import { BANK, PAYMENT_TERM_DAYS, SELLER, VAT_RATE } from './constants';
import { formatDate, formatNumber, formatPercent } from './format';
import { formatNip } from './nip';
import type { Order } from '@/types/order';

/**
 * Proforma invoice generation.
 *
 * A proforma is not a VAT invoice — it is a request for payment that lets the
 * buyer's finance department release a transfer. What matters is that the
 * amount, the account number and the payment reference are unambiguous, and
 * that the buyer's own name is spelled correctly.
 *
 * That last point is why fonts are embedded. The PDF built-in faces use WinAnsi
 * encoding, which has no Polish diacritics, so "Wrocław" and "Poznań" would come
 * out mangled on a document going to an accountant.
 */

const FONT_DIR = join(process.cwd(), 'src/assets/fonts');
const FONT_FAMILY = 'Liberation Sans';

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;

  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: join(FONT_DIR, 'LiberationSans-Regular.ttf'), fontWeight: 'normal' },
      { src: join(FONT_DIR, 'LiberationSans-Bold.ttf'), fontWeight: 'bold' },
    ],
  });

  // Long SKUs and product names must break rather than overflow their column.
  Font.registerHyphenationCallback((word) => [word]);

  fontsRegistered = true;
}

const INK = '#1c1917';
const MUTED = '#57534e';
const LINE = '#d6d3d1';
const BRAND = '#1d4ed8';
const SUNKEN = '#f5f5f4';

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: INK,
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    lineHeight: 1.4,
  },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 16, fontWeight: 'bold' },
  titlePl: { fontSize: 10, color: MUTED, marginTop: 1 },
  number: { fontSize: 13, fontWeight: 'bold', color: BRAND, textAlign: 'right' },
  numberLabel: { fontSize: 8, color: MUTED, textAlign: 'right' },

  rule: { borderBottomWidth: 1, borderBottomColor: LINE, marginTop: 12, marginBottom: 14 },

  parties: { flexDirection: 'row', gap: 24 },
  party: { flex: 1 },
  partyLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  partyName: { fontWeight: 'bold', marginBottom: 2 },
  partyLine: { color: MUTED },

  metaRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  metaValue: { marginTop: 1 },

  sectionLabel: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 5,
  },

  tableHead: {
    flexDirection: 'row',
    backgroundColor: SUNKEN,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: LINE,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: { fontSize: 7.5, fontWeight: 'bold', color: MUTED, textTransform: 'uppercase' },

  colIndex: { width: 20 },
  colSku: { width: 82 },
  colName: { flex: 1, paddingRight: 6 },
  colQty: { width: 42, textAlign: 'right' },
  colUnit: { width: 68, textAlign: 'right' },
  colTotal: { width: 76, textAlign: 'right' },

  totals: { marginTop: 12, flexDirection: 'row', justifyContent: 'flex-end' },
  totalsBox: { width: 240 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totalsLabel: { color: MUTED },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: LINE,
    marginTop: 4,
    paddingTop: 5,
  },
  grandLabel: { fontWeight: 'bold' },
  grandValue: { fontSize: 12, fontWeight: 'bold' },

  payment: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: BRAND,
    borderRadius: 3,
    padding: 10,
  },
  payGrid: { flexDirection: 'row', gap: 20, marginTop: 6 },
  payCell: { flex: 1 },
  payLabel: { fontSize: 7.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  payValue: { marginTop: 1, fontWeight: 'bold' },

  notes: { marginTop: 14 },

  footerRule: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: LINE,
  },
  footerText: {
    position: 'absolute',
    bottom: 26,
    left: 40,
    right: 90,
    fontSize: 7.5,
    color: MUTED,
  },
  footerPage: {
    position: 'absolute',
    bottom: 26,
    right: 40,
    fontSize: 7.5,
    color: MUTED,
    textAlign: 'right',
  },
});

/** Money, rendered the Polish way: `1 732,50`. The currency is stated once per column. */
const money = (value: number) => formatNumber(value, 2);

export function ProformaDocument({ order }: { order: Order }) {
  const issued = order.date_created ? new Date(order.date_created) : new Date();
  const due = new Date(issued);
  due.setDate(due.getDate() + PAYMENT_TERM_DAYS);

  return (
    <Document
      title={`Proforma ${order.order_number}`}
      author={SELLER.name}
      subject={`Proforma invoice ${order.order_number}`}
      creator="Solaris Components storefront"
    >
      <Page
        size="A4"
        style={styles.page}
        // Page chrome goes here rather than in `fixed` children with a `render`
        // prop: `render` is typed and documented but does nothing in
        // @react-pdf/renderer 4.8.1 — verified by rendering a constant from it
        // and getting an empty node. `layout` is where v4 exposes the page
        // counters, and it repeats its non-`children` output on every page.
        layout={({ children, pageNumber, totalPages }) => (
          <>
            {children}
            <View style={styles.footerRule} />
            <Text style={styles.footerText}>
              This is a proforma invoice and does not constitute a VAT invoice. ·
              Niniejszy dokument jest fakturą proforma i nie stanowi faktury VAT.
            </Text>
            <Text style={styles.footerPage}>
              {pageNumber} / {totalPages}
            </Text>
          </>
        )}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Proforma Invoice</Text>
            <Text style={styles.titlePl}>Faktura proforma</Text>
          </View>
          <View>
            <Text style={styles.numberLabel}>No. / Nr</Text>
            <Text style={styles.number}>{order.order_number}</Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Seller / Sprzedawca</Text>
            <Text style={styles.partyName}>{SELLER.name}</Text>
            <Text style={styles.partyLine}>{SELLER.address}</Text>
            <Text style={styles.partyLine}>
              {SELLER.postalCode} {SELLER.city}, {SELLER.country}
            </Text>
            <Text style={styles.partyLine}>NIP {formatNip(SELLER.nip)}</Text>
            <Text style={styles.partyLine}>{SELLER.email}</Text>
          </View>

          <View style={styles.party}>
            <Text style={styles.partyLabel}>Buyer / Nabywca</Text>
            {order.invoice_type === 'nip' ? (
              <>
                <Text style={styles.partyName}>{order.company_name}</Text>
                {(order.company_address ?? '').split('\n').map((line, index) => (
                  <Text key={index} style={styles.partyLine}>
                    {line}
                  </Text>
                ))}
                <Text style={styles.partyLine}>NIP {formatNip(order.nip ?? '')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.partyName}>Faktura bezimienna</Text>
                <Text style={styles.partyLine}>
                  Anonymous invoice — issued without buyer identification.
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Issued / Data wystawienia</Text>
            <Text style={styles.metaValue}>{formatDate(issued)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Due / Termin płatności</Text>
            <Text style={styles.metaValue}>{formatDate(due)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Payment / Płatność</Text>
            <Text style={styles.metaValue}>Bank transfer / Przelew</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Currency / Waluta</Text>
            <Text style={styles.metaValue}>PLN</Text>
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <Text style={styles.sectionLabel}>Items / Pozycje</Text>

          {/* Repeated on every page: a two-page order otherwise has a table of
              unlabelled numbers on the second sheet. */}
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.colIndex]}>#</Text>
            <Text style={[styles.th, styles.colSku]}>SKU</Text>
            <Text style={[styles.th, styles.colName]}>Description / Nazwa</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit net</Text>
            <Text style={[styles.th, styles.colTotal]}>Net total</Text>
          </View>

          {order.items.map((item, index) => (
            <View key={item.id} style={styles.row} wrap={false}>
              <Text style={styles.colIndex}>{index + 1}</Text>
              <Text style={styles.colSku}>{item.product_sku}</Text>
              <Text style={styles.colName}>{item.product_name}</Text>
              <Text style={styles.colQty}>{formatNumber(item.quantity, 0)}</Text>
              <Text style={styles.colUnit}>{money(item.unit_price)}</Text>
              <Text style={styles.colTotal}>{money(item.line_total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal, net / Wartość netto</Text>
              <Text>{money(order.subtotal_net)} PLN</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                VAT {formatPercent(VAT_RATE)} / Podatek VAT
              </Text>
              <Text>{money(order.vat_amount)} PLN</Text>
            </View>
            <View style={styles.grandRow}>
              <Text style={styles.grandLabel}>Total, gross / Do zapłaty</Text>
              <Text style={styles.grandValue}>{money(order.total_gross)} PLN</Text>
            </View>
          </View>
        </View>

        <View style={styles.payment} wrap={false}>
          <Text style={styles.sectionLabel}>Payment details / Dane do przelewu</Text>

          <View style={styles.payGrid}>
            <View style={{ flex: 2 }}>
              <Text style={styles.payLabel}>Account / Numer konta</Text>
              <Text style={styles.payValue}>{BANK.iban}</Text>
              <Text style={[styles.partyLine, { marginTop: 3 }]}>
                {BANK.bankName} · SWIFT {BANK.swift}
              </Text>
            </View>
            <View style={styles.payCell}>
              <Text style={styles.payLabel}>Reference / Tytuł przelewu</Text>
              <Text style={styles.payValue}>{order.order_number}</Text>
            </View>
            <View style={styles.payCell}>
              <Text style={styles.payLabel}>Amount / Kwota</Text>
              <Text style={styles.payValue}>{money(order.total_gross)} PLN</Text>
            </View>
          </View>
        </View>

        <View style={styles.notes}>
          <Text style={styles.sectionLabel}>Delivery / Dostawa</Text>
          <Text style={styles.partyLine}>
            {order.delivery_name}, {order.delivery_address}, {order.delivery_postal_code}{' '}
            {order.delivery_city}
          </Text>
          <Text style={styles.partyLine}>
            {order.delivery_phone} · {order.delivery_email}
          </Text>
          {order.notes ? (
            <Text style={[styles.partyLine, { marginTop: 4 }]}>Notes: {order.notes}</Text>
          ) : null}
          <Text style={[styles.partyLine, { marginTop: 6 }]}>
            Shipping is quoted separately and is not included in the amount above.
          </Text>
        </View>

      </Page>
    </Document>
  );
}

/** Renders the proforma for an order to a PDF buffer. */
export async function renderProforma(order: Order): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ProformaDocument order={order} />);
}

/** `proforma-SO-2026-00001.pdf` */
export function proformaFilename(order: Order): string {
  return `proforma-${order.order_number}.pdf`;
}
