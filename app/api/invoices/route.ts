import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS, getDb } from '@/lib/db';
import { toApiDocs } from '@/lib/serialize';

// Read-only + PDF rendering — invoices are only ever created as a side effect of a payment
// completing an order in full (see orderWorkflow.recordPayment + app/api/orders/[id]/payments's
// POST), so there is no direct create endpoint here. Mirrors backend/app/routers/invoices.py.
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('order_id');
  const customerId = searchParams.get('customer_id');

  const query: Record<string, unknown> = {};
  if (orderId) query.order_id = orderId;
  if (customerId) query.customer_id = customerId;

  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.invoices).find(query).sort({ issued_date: -1 }).toArray();
  return Response.json(toApiDocs(docs));
}
