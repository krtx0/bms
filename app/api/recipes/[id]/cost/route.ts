import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { findByIds, getOne } from '@/lib/crud';
import {
  calculateCakeCost,
  calculateComponentCostForRecipe,
  calculateProfitMarginPct,
  calculateTotalProductCost,
} from '@/lib/services/costing';
import { resolveComponentLines, resolveIngredientLines } from '@/lib/services/costResolution';
import type { Component, Ingredient, Recipe } from '@/types';

// Mirrors backend/app/routers/recipes.py's GET /{id}/cost — resolves both the recipe's own
// direct ingredients and its components' nested ingredients.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { id } = await params;
  const recipe = await getOne<Recipe>(COLLECTIONS.recipes, id);
  if (!recipe) return Response.json({ detail: 'Recipe not found' }, { status: 404 });

  const componentIds = recipe.components.map((line) => line.component_id);
  const componentsById = await findByIds<Component>(COLLECTIONS.components, componentIds);

  // Ingredients needed = the recipe's own direct ingredients + every ingredient each of its
  // components uses — fetch them all in one round trip.
  const ingredientIds = recipe.base_ingredients.map((line) => line.ingredient_id);
  for (const component of Object.values(componentsById)) {
    ingredientIds.push(...component.ingredient_list.map((line) => line.ingredient_id));
  }
  const ingredientsById = await findByIds<Ingredient>(COLLECTIONS.ingredients, ingredientIds);

  let base: ReturnType<typeof resolveIngredientLines>;
  let comp: ReturnType<typeof resolveComponentLines>;
  try {
    base = resolveIngredientLines(recipe.base_ingredients, ingredientsById);
    comp = resolveComponentLines(recipe.components, componentsById, ingredientsById);
  } catch (err) {
    return Response.json({ detail: err instanceof Error ? err.message : 'Not found' }, { status: 404 });
  }

  const cakeCost = calculateCakeCost(base.pairs);
  const componentCost = calculateComponentCostForRecipe(comp.pairs);
  const totalProductCost = calculateTotalProductCost(cakeCost, componentCost);
  const profitMarginPct = calculateProfitMarginPct(recipe.base_cake_price, totalProductCost);

  return Response.json({
    cake_cost: cakeCost,
    component_cost: componentCost,
    total_product_cost: totalProductCost,
    base_cake_price: recipe.base_cake_price,
    profit_margin_pct: profitMarginPct,
    ingredient_breakdown: base.breakdown,
    component_breakdown: comp.breakdown,
  });
}
