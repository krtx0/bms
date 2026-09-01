import { requireAuth, unauthorized } from '@/lib/auth';
import { getOne, notFoundResponse } from '@/lib/crud';
import { COLLECTIONS } from '@/lib/db';
import type { Purchase } from '@/types';

const LABEL = 'Purchase';

// GET only — no PATCH/DELETE, see app/api/purchases/route.ts's header comment.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const purchase = await getOne<Purchase>(COLLECTIONS.purchases, id);
  if (!purchase) return notFoundResponse(LABEL);
  return Response.json(purchase);
}
