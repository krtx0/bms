import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { conflictResponse, createOne, isDuplicateKeyError, listAll } from '@/lib/crud';

const LABEL = 'Recipe';
const DUPLICATE_MESSAGE = 'Flavour code already exists';

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  return Response.json(await listAll(COLLECTIONS.recipes));
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = await request.json();
  try {
    const created = await createOne(COLLECTIONS.recipes, payload);
    return Response.json(created, { status: 201 });
  } catch (err) {
    if (isDuplicateKeyError(err)) return conflictResponse(LABEL, DUPLICATE_MESSAGE);
    throw err;
  }
}
