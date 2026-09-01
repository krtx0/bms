import { requireAuth, unauthorized } from '@/lib/auth';
import { deleteOne, getOne, notFoundResponse, updateOne } from '@/lib/crud';
import { COLLECTIONS } from '@/lib/db';
import type { Customer } from '@/types';

const LABEL = 'Customer';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const item = await getOne<Customer>(COLLECTIONS.customers, id);
  if (!item) return notFoundResponse(LABEL);
  return Response.json(item);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const payload = await request.json();
  const updated = await updateOne<Customer>(COLLECTIONS.customers, id, payload);
  if (!updated) return notFoundResponse(LABEL);
  return Response.json(updated);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const ok = await deleteOne(COLLECTIONS.customers, id);
  if (!ok) return notFoundResponse(LABEL);
  return new Response(null, { status: 204 });
}
