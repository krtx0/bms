import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS, getDb } from '@/lib/db';
import { toApiDocs } from '@/lib/serialize';
import { createOrder, HttpError, type OrderCreatePayload } from '@/lib/services/orderWorkflow';

// Mirrors backend/app/routers/orders.py's list_orders/create_order. The heavy lifting for POST
// lives in orderWorkflow.createOrder — this route stays thin: parse, delegate, shape the errors.
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const customerId = searchParams.get('customer_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const query: Record<string, unknown> = {};
  if (status) query.status = status;
  if (customerId) query.customer_id = customerId;
  if (dateFrom || dateTo) {
    const deliveryDateQuery: Record<string, Date> = {};
    if (dateFrom) deliveryDateQuery.$gte = new Date(dateFrom);
    if (dateTo) deliveryDateQuery.$lte = new Date(dateTo);
    query.delivery_date = deliveryDateQuery;
  }

  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.orders).find(query).sort({ created_at: -1 }).toArray();
  return Response.json(toApiDocs(docs));
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = (await request.json()) as OrderCreatePayload;
  try {
    const order = await createOrder(payload);
    return Response.json(order, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ detail: err.message }, { status: err.status });
    throw err;
  }
}
