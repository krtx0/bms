import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { createOne, listAll } from '@/lib/crud';

// Plain CRUD (no unique index on expenses, unlike suppliers/ingredients/etc.) — a deliberate
// small scope-addition, not one of the original 9 client-spec modules, purely so Net
// Profit/Expense Summary are computable. Mirrors backend/app/routers/expenses.py's
// make_crud_router.

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  return Response.json(await listAll(COLLECTIONS.expenses));
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = await request.json();
  // expense_date must be a real BSON Date (not the string the client sends) so the financial
  // report's {$gte, $lt} range match against it works — same discipline as purchase_date/
  // delivery_date elsewhere (createOne itself does no date coercion, see lib/crud.ts).
  const created = await createOne(COLLECTIONS.expenses, { ...payload, expense_date: new Date(payload.expense_date) });
  return Response.json(created, { status: 201 });
}
