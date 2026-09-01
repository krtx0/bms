// Resolves embedded ingredient/component references against live-fetched pricing docs. Ported
// verbatim from backend/app/services/cost_resolution.py.
//
// Pure-ish: takes already-fetched maps keyed by string id, never touches the DB itself. Shared
// by app/api/components/[id]/cost and app/api/recipes/[id]/cost so both price things through
// the exact same loop instead of duplicating it.

import { calculateComponentUnitCost, type WeightedLine } from './costing';
import type {
  Component,
  ComponentLine,
  CostBreakdownLine,
  Ingredient,
  IngredientLine,
  RecipeComponentBreakdownLine,
} from '@/types';

/**
 * (qty, unitCost) pairs — feed to calculateCakeCost or calculateComponentUnitCost — plus a
 * UI-ready breakdown. Throws (message: "Ingredient {id} not found") if a referenced ingredient
 * isn't in the map — mirrors the Python version's ValueError, which routes translate to a 404.
 */
export function resolveIngredientLines(
  lines: IngredientLine[],
  ingredientsById: Record<string, Ingredient>
): { pairs: WeightedLine[]; breakdown: CostBreakdownLine[] } {
  const pairs: WeightedLine[] = [];
  const breakdown: CostBreakdownLine[] = [];
  for (const line of lines) {
    const ingredientId = String(line.ingredient_id);
    const ingredient = ingredientsById[ingredientId];
    if (!ingredient) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }
    const unitCost = ingredient.current_cost_per_unit;
    pairs.push([line.qty_per_unit, unitCost]);
    breakdown.push({
      ingredient_id: ingredientId,
      name: ingredient.name,
      qty_per_unit: line.qty_per_unit,
      unit_cost: unitCost,
      line_cost: line.qty_per_unit * unitCost,
    });
  }
  return { pairs, breakdown };
}

/**
 * (qty, componentUnitCost) pairs — feed to calculateComponentCostForRecipe — plus a UI-ready
 * breakdown. Each component's own unit cost is resolved the same way the components /cost
 * route does (resolveIngredientLines + calculateComponentUnitCost).
 */
export function resolveComponentLines(
  lines: ComponentLine[],
  componentsById: Record<string, Component>,
  ingredientsById: Record<string, Ingredient>
): { pairs: WeightedLine[]; breakdown: RecipeComponentBreakdownLine[] } {
  const pairs: WeightedLine[] = [];
  const breakdown: RecipeComponentBreakdownLine[] = [];
  for (const line of lines) {
    const componentId = String(line.component_id);
    const component = componentsById[componentId];
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }
    const { pairs: ingredientPairs } = resolveIngredientLines(component.ingredient_list, ingredientsById);
    const unitCost = calculateComponentUnitCost(ingredientPairs);
    pairs.push([line.qty_per_unit, unitCost]);
    breakdown.push({
      component_id: componentId,
      name: component.name,
      qty_per_unit: line.qty_per_unit,
      unit_cost: unitCost,
      line_cost: line.qty_per_unit * unitCost,
    });
  }
  return { pairs, breakdown };
}
