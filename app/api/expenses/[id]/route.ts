import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { deleteOne, getOne, notFoundResponse, updateOne } from '@/lib/crud';

const LABEL = 'Expense';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const item = await getOne(COLLECTIONS.expenses, id);
  if (!item) return notFoundResponse(LABEL);
  return Response.json(item);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const payload = await request.json();
  const changes = payload.expense_date ? { ...payload, expense_date: new Date(payload.expense_date) } : payload;
  const updated = await updateOne(COLLECTIONS.expenses, id, changes);
  if (!updated) return notFoundResponse(LABEL);
  return Response.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const ok = await deleteOne(COLLECTIONS.expenses, id);
  if (!ok) return notFoundResponse(LABEL);
  return new Response(null, { status: 204 });
}
