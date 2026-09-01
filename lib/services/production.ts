// Pure BOM-explosion functions — no DB access. Ported from
// backend/app/services/production.py's calculate_required_components /
// calculate_full_ingredient_requirement.
//
// calculateFullIngredientRequirement here takes recipesById directly (rather than the Python
// version's pre-resolved [(component_id, qty_per_unit), ...] tuples per line) so the caller
// (orderWorkflow's production step) can pass order.line_items + a fetched recipe map straight
// through instead of building an intermediate list itself. It deliberately does NOT take a
// componentsById map: this function only sums each recipe's OWN base_ingredients (direct,
// per-cake ingredients) — a component's nested ingredient_list is irrelevant here, it only
// matters once a component runs FIFO-short and gets converted via
// resolveComponentShortfallToIngredients (a separate step, in orderWorkflow.ts).

import type { Recipe } from '@/types';

/** recipeComponents: [(componentId, qtyPerUnit), ...] for ONE recipe (one order line item). */
export function calculateRequiredComponents(
  recipeComponents: [componentId: string, qtyPerUnit: number][],
  orderQuantity: number
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [componentId, qtyPerUnit] of recipeComponents) {
    result[componentId] = (result[componentId] ?? 0) + qtyPerUnit * orderQuantity;
  }
  return result;
}

export interface FullIngredientRequirement {
  components: Record<string, number>;
  ingredients: Record<string, number>;
}

/**
 * Merges component + direct-ingredient requirements across every line item. `ingredients` is
 * direct (base_ingredients) totals only — it does NOT fold in component-shortfall conversion,
 * since that needs live FIFO results from the DB (done separately, after this, in
 * orderWorkflow.ts's production step).
 */
export function calculateFullIngredientRequirement(
  lineItems: { recipe_id: string; quantity: number }[],
  recipesById: Record<string, Recipe>
): FullIngredientRequirement {
  const components: Record<string, number> = {};
  const ingredients: Record<string, number> = {};
  for (const line of lineItems) {
    const recipe = recipesById[line.recipe_id];
    if (!recipe) continue; // recipe deleted since the order was placed — nothing to explode
    const recipeComponents: [string, number][] = recipe.components.map((c) => [c.component_id, c.qty_per_unit]);
    for (const [componentId, qty] of Object.entries(calculateRequiredComponents(recipeComponents, line.quantity))) {
      components[componentId] = (components[componentId] ?? 0) + qty;
    }
    for (const ing of recipe.base_ingredients) {
      ingredients[ing.ingredient_id] = (ingredients[ing.ingredient_id] ?? 0) + ing.qty_per_unit * line.quantity;
    }
  }
  return { components, ingredients };
}
