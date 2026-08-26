import { getOrderById } from '@/lib/orders';
import { proformaFilename, renderProforma } from '@/lib/pdf';

/**
 * Proforma download.
 *
 * Generated on request rather than stored: the document is a pure function of
 * the order, so a stored copy would only add a file to keep in sync with a
 * record that can still be corrected in the Directus admin.
 *
 * Addressed by the order's UUID, like the confirmation page, and served
 * uncached — a proforma is one buyer's payment instruction and has no business
 * in a shared cache.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);

  if (!order) {
    return new Response('Order not found', { status: 404 });
  }

  const pdf = await renderProforma(order);

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      // `inline` so the browser previews it; the filename still applies when
      // the viewer's save button is used.
      'Content-Disposition': `inline; filename="${proformaFilename(order)}"`,
      'Content-Length': String(pdf.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
