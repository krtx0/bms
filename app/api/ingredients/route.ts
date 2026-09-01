import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { conflictResponse, createOne, isDuplicateKeyError, listAll } from '@/lib/crud';

const LABEL = 'Ingredient';

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  return Response.json(await listAll(COLLECTIONS.ingredients));
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = await request.json();
  try {
    const created = await createOne(COLLECTIONS.ingredients, payload);
    return Response.json(created, { status: 201 });
  } catch (err) {
    if (isDuplicateKeyError(err)) return conflictResponse(LABEL);
    throw err;
  }
}
