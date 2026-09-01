import { requireAuth, unauthorized } from '@/lib/auth';
import { getOne, notFoundResponse } from '@/lib/crud';
import { COLLECTIONS } from '@/lib/db';
import type { Invoice } from '@/types';

const LABEL = 'Invoice';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const invoice = await getOne<Invoice>(COLLECTIONS.invoices, id);
  if (!invoice) return notFoundResponse(LABEL);
  return Response.json(invoice);
}
