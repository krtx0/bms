import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS, getDb } from '@/lib/db';
import { toApiDocs } from '@/lib/serialize';

// Mirrors backend/app/routers/inventory.py's GET /movements — both query params optional,
// newest first (audit trail order).
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const params = new URL(request.url).searchParams;
  const itemType = params.get('item_type');
  const itemId = params.get('item_id');

  const query: Record<string, string> = {};
  if (itemType) query.item_type = itemType;
  if (itemId) query.item_id = itemId;

  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.inventoryMovements).find(query).sort({ created_at: -1 }).toArray();
  return Response.json(toApiDocs(docs));
}
