import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { findByIds, getOne } from '@/lib/crud';
import { calculateComponentUnitCost } from '@/lib/services/costing';
import { resolveIngredientLines } from '@/lib/services/costResolution';
import type { Component, Ingredient } from '@/types';

// Mirrors backend/app/routers/components.py's GET /{id}/cost.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const component = await getOne<Component>(COLLECTIONS.components, id);
  if (!component) return Response.json({ detail: 'Component not found' }, { status: 404 });

  const ingredientIds = component.ingredient_list.map((line) => line.ingredient_id);
  const ingredientsById = await findByIds<Ingredient>(COLLECTIONS.ingredients, ingredientIds);

  try {
    const { pairs, breakdown } = resolveIngredientLines(component.ingredient_list, ingredientsById);
    return Response.json({ unit_cost: calculateComponentUnitCost(pairs), breakdown });
  } catch (err) {
    return Response.json({ detail: err instanceof Error ? err.message : 'Not found' }, { status: 404 });
  }
}
