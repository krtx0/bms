import { requireAuth, unauthorized } from '@/lib/auth';
import { createOne, listAll } from '@/lib/crud';
import { COLLECTIONS } from '@/lib/db';
import type { Customer } from '@/types';

// Plain CRUD — no unique index on phone (a household can share one), mirrors
// backend/app/routers/customers.py's make_crud_router.
export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  return Response.json(await listAll(COLLECTIONS.customers));
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = await request.json();
  // important_dates is the one field the Customers form never sends (Future Leads is the only
  // place it's managed, per design) — default it so every doc has an array, not an absent field
  // (Future Leads/CustomersPage both iterate/spread customer.important_dates unconditionally).
  const created = await createOne<Customer>(COLLECTIONS.customers, {
    ...payload,
    important_dates: payload.important_dates ?? [],
  });
  return Response.json(created, { status: 201 });
}
