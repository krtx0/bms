import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS, getDb } from '@/lib/db';
import { toApiDocs } from '@/lib/serialize';
import { generateInvoiceForOrder } from '@/lib/services/invoicing';
import { HttpError, recordPayment } from '@/lib/services/orderWorkflow';

// Mirrors backend/app/routers/orders.py's create_payment/list_order_payments.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.payments).find({ order_id: id }).sort({ payment_date: -1 }).toArray();
  return Response.json(toApiDocs(docs));
}

interface PaymentCreatePayload {
  amount: number;
  method?: string;
  notes?: string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const payload = (await request.json()) as PaymentCreatePayload;
  if (!(payload.amount > 0)) {
    return Response.json({ detail: 'amount must be greater than 0' }, { status: 400 });
  }

  try {
    const { order, becameFullyPaidJustNow } = await recordPayment(id, payload.amount, payload.method ?? '', payload.notes ?? '');
    // Invoicing triggers exactly once: only on the actual transition into Fully Paid, not on
    // every payment recorded against an already-fully-paid order.
    let invoiceId: string | null = null;
    if (becameFullyPaidJustNow) {
      const invoice = await generateInvoiceForOrder(order);
      invoiceId = invoice.id;
    }
    return Response.json({ order, invoice_id: invoiceId });
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ detail: err.message }, { status: err.status });
    throw err;
  }
}
