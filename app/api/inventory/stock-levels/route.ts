import { requireAuth, unauthorized } from '@/lib/auth';
import { computeStockLevels } from '@/lib/services/inventory';
import type { ItemType } from '@/types';

const VALID_ITEM_TYPES = new Set<string>(['ingredient', 'packaging', 'semi_finished']);

// Mirrors backend/app/routers/inventory.py's GET /stock-levels.
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const itemTypeParam = new URL(request.url).searchParams.get('item_type');
  if (itemTypeParam && !VALID_ITEM_TYPES.has(itemTypeParam)) {
    return Response.json({ detail: 'Invalid item_type' }, { status: 400 });
  }

  return Response.json(await computeStockLevels((itemTypeParam as ItemType) ?? undefined));
}
