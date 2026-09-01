import { listAll } from '@/lib/crud';
import { COLLECTIONS } from '@/lib/db';
import type { Recipe } from '@/types';

// Unauthenticated — backs the public order-intake form's flavour picker. Deliberately returns
// only id/name/flavour_code, never base_cake_price/base_ingredients/components: those are cost/
// recipe IP that stays behind requireAuth() on GET /api/recipes.
export async function GET() {
  const recipes = await listAll<Recipe>(COLLECTIONS.recipes);
  return Response.json(recipes.map((r) => ({ id: r.id, name: r.name, flavour_code: r.flavour_code })));
}
