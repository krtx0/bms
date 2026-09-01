import { requireAuth, unauthorized } from '@/lib/auth';
import { getOne, notFoundResponse } from '@/lib/crud';
import { COLLECTIONS } from '@/lib/db';
import { renderInvoicePdf } from '@/lib/services/invoicing';
import type { Customer, Invoice, Order } from '@/types';

// Mirrors backend/app/routers/invoices.py's get_invoice_pdf.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const invoice = await getOne<Invoice>(COLLECTIONS.invoices, id);
  if (!invoice) return notFoundResponse('Invoice');
  const order = await getOne<Order>(COLLECTIONS.orders, invoice.order_id);
  if (!order) return notFoundResponse('Order');
  const customer = await getOne<Customer>(COLLECTIONS.customers, invoice.customer_id);
  if (!customer) return notFoundResponse('Customer');

  const pdfBytes = await renderInvoicePdf(order, customer, invoice);
  // Buffer's current @types/node generic (Buffer<ArrayBufferLike>) doesn't structurally match
  // lib.dom's BodyInit union directly — wrap in a plain Uint8Array, which does.
  return new Response(new Uint8Array(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
