// Mirrors backend/app/tests/test_production_planning.py — same scenario, same hand-computed
// numbers: line A uses recipe X (1 direct ingredient P, 1 component C — C itself uses ingredient
// Q, irrelevant here), qty 3; line B uses recipe Y (the SAME component C, plus a different direct
// ingredient R), qty 2.

import { expect, it } from 'vitest';
import { calculateFullIngredientRequirement, calculateRequiredComponents } from './production';
import type { Recipe } from '@/types';

function recipe(overrides: Partial<Recipe>): Recipe {
  return {
    id: 'recipe-id',
    flavour_code: 'FLV',
    name: 'Test flavour',
    base_cake_price: 100,
    base_ingredients: [],
    components: [],
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const recipesById: Record<string, Recipe> = {
  'recipe-X': recipe({
    base_ingredients: [{ ingredient_id: 'ingredient-P', qty_per_unit: 2 }],
    components: [{ component_id: 'component-C', qty_per_unit: 1 }],
  }),
  'recipe-Y': recipe({
    base_ingredients: [{ ingredient_id: 'ingredient-R', qty_per_unit: 4 }],
    components: [{ component_id: 'component-C', qty_per_unit: 3 }],
  }),
};

it('calculateRequiredComponents scales by order quantity', () => {
  expect(calculateRequiredComponents([['component-C', 1]], 3)).toEqual({ 'component-C': 3 });
});

it('calculateFullIngredientRequirement merges shared components and direct ingredients across line items', () => {
  const lineItems = [
    { recipe_id: 'recipe-X', quantity: 3 },
    { recipe_id: 'recipe-Y', quantity: 2 },
  ];

  const result = calculateFullIngredientRequirement(lineItems, recipesById);

  // Hand-computed: C = (1*3) + (3*2) = 3 + 6 = 9 — summed across both lines, not overwritten.
  expect(result.components).toEqual({ 'component-C': 9 });
  // Hand-computed direct ingredients: P = 2*3 = 6, R = 4*2 = 8 (no cross-over between lines).
  // Ingredient Q (inside component C) never appears — exploding a component's own ingredients
  // only happens later, for FIFO shortfalls (resolveComponentShortfallToIngredients).
  expect(result.ingredients).toEqual({ 'ingredient-P': 6, 'ingredient-R': 8 });
});

it('calculateFullIngredientRequirement of no line items is empty', () => {
  expect(calculateFullIngredientRequirement([], recipesById)).toEqual({ components: {}, ingredients: {} });
});

it('calculateFullIngredientRequirement skips a line whose recipe is missing (deleted since order creation)', () => {
  const result = calculateFullIngredientRequirement([{ recipe_id: 'does-not-exist', quantity: 5 }], recipesById);
  expect(result).toEqual({ components: {}, ingredients: {} });
});
