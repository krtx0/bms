import { requireAuth, unauthorized } from '@/lib/auth';
import { getOne, notFoundResponse, updateOne } from '@/lib/crud';
import { COLLECTIONS } from '@/lib/db';
import type { Order } from '@/types';

const LABEL = 'Order';
const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const order = await getOne<Order>(COLLECTIONS.orders, id);
  if (!order) return notFoundResponse(LABEL);
  return Response.json(order);
}

// Deliberate simplification, matches backend/app/routers/orders.py's update_order: line_items
// are a frozen cost snapshot (see the CRITICAL section in orderWorkflow.ts) and are NOT editable
// through this endpoint — re-snapshotting costs (and potentially undoing/redoing FIFO production
// deduction if the order's already past Production) is real complexity this app doesn't need. If
// the products on an order need to change, cancel and recreate it instead.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const payload = await request.json();
  const changes: Record<string, unknown> = {};
  if (payload.event_date !== undefined) changes.event_date = new Date(payload.event_date);
  if (payload.delivery_date !== undefined) changes.delivery_date = new Date(payload.delivery_date);
  if (payload.notes !== undefined) changes.notes = payload.notes;
  if (payload.customer_id !== undefined) changes.customer_id = payload.customer_id;
  if (payload.priority !== undefined) {
    if (!VALID_PRIORITIES.has(payload.priority)) return Response.json({ detail: 'Invalid priority' }, { status: 400 });
    changes.priority = payload.priority;
  }

  const updated = await updateOne<Order>(COLLECTIONS.orders, id, changes);
  if (!updated) return notFoundResponse(LABEL);
  return Response.json(updated);
}
