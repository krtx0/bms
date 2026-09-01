import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { conflictResponse, deleteOne, getOne, isDuplicateKeyError, notFoundResponse, updateOne } from '@/lib/crud';

const LABEL = 'Supplier';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const item = await getOne(COLLECTIONS.suppliers, id);
  if (!item) return notFoundResponse(LABEL);
  return Response.json(item);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const payload = await request.json();
  try {
    const updated = await updateOne(COLLECTIONS.suppliers, id, payload);
    if (!updated) return notFoundResponse(LABEL);
    return Response.json(updated);
  } catch (err) {
    if (isDuplicateKeyError(err)) return conflictResponse(LABEL);
    throw err;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const ok = await deleteOne(COLLECTIONS.suppliers, id);
  if (!ok) return notFoundResponse(LABEL);
  return new Response(null, { status: 204 });
}
