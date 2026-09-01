import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS, getDb } from '@/lib/db';
import { toApiDocs } from '@/lib/serialize';

const VALID_ITEM_TYPES = new Set<string>(['ingredient', 'packaging', 'semi_finished']);

// Mirrors backend/app/routers/inventory.py's GET /batches — both query params required, sorted
// oldest-received-first (FIFO order).
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const params = new URL(request.url).searchParams;
  const itemType = params.get('item_type');
  const itemId = params.get('item_id');
  if (!itemType || !itemId) {
    return Response.json({ detail: 'item_type and item_id are required' }, { status: 400 });
  }
  if (!VALID_ITEM_TYPES.has(itemType)) {
    return Response.json({ detail: 'Invalid item_type' }, { status: 400 });
  }

  const db = await getDb();
  const docs = await db
    .collection(COLLECTIONS.inventoryBatches)
    .find({ item_type: itemType, item_id: itemId })
    .sort({ received_date: 1 })
    .toArray();
  return Response.json(toApiDocs(docs));
}
