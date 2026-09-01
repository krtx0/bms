// Shared inventory helpers used by app/api/inventory/* and app/api/purchases/* routes. Ported
// from backend/app/routers/inventory.py's module-level ITEM_TYPE_COLLECTIONS / _lookup_item /
// _unit_cost_for / _stock_level_row (which backend/app/routers/purchases.py also imports
// ITEM_TYPE_COLLECTIONS from) — factored into lib/services here since Next.js route handlers
// only export HTTP method handlers, not shared helpers.

import { findByIds, getOne } from '@/lib/crud';
import { COLLECTIONS, getDb } from '@/lib/db';
import { calculateComponentUnitCost, isLowStock } from '@/lib/services/costing';
import { resolveIngredientLines } from '@/lib/services/costResolution';
import type { Component, Ingredient, ItemType, MaterialItem, StockLevel } from '@/types';

export type StockItem = MaterialItem | Component;

// item_type -> the master collection its item_id points into.
export const ITEM_TYPE_COLLECTIONS: Record<ItemType, string> = {
  ingredient: COLLECTIONS.ingredients,
  packaging: COLLECTIONS.packaging,
  semi_finished: COLLECTIONS.components,
};

export async function lookupItem(itemType: ItemType, itemId: string): Promise<StockItem | null> {
  return getOne<StockItem>(ITEM_TYPE_COLLECTIONS[itemType], itemId);
}

/**
 * Cost basis for a new stock batch. Ingredients/packaging carry a static
 * current_cost_per_unit; semi-finished components don't define one (a Component has no such
 * field — its cost is derived from its own ingredient list), so it's computed live the same way
 * GET /components/{id}/cost does. Throws ("Ingredient {id} not found") if a referenced
 * ingredient is missing — callers turn that into a 404, same as the components /cost route.
 */
export async function unitCostFor(itemType: ItemType, item: StockItem): Promise<number> {
  if (itemType !== 'semi_finished') {
    return (item as MaterialItem).current_cost_per_unit;
  }
  const component = item as Component;
  const ingredientIds = component.ingredient_list.map((line) => line.ingredient_id);
  const ingredientsById = await findByIds<Ingredient>(COLLECTIONS.ingredients, ingredientIds);
  const { pairs } = resolveIngredientLines(component.ingredient_list, ingredientsById);
  return calculateComponentUnitCost(pairs);
}

/** Current stock + low-stock flag for one item — the response shape for POST /adjustments. */
export async function stockLevelRow(itemType: ItemType, itemId: string): Promise<StockLevel | null> {
  const item = await lookupItem(itemType, itemId);
  if (!item) return null;
  const db = await getDb();
  const batches = await db
    .collection(COLLECTIONS.inventoryBatches)
    .find({ item_type: itemType, item_id: itemId, remaining_qty: { $gt: 0 } })
    .toArray();
  const currentStock = batches.reduce((sum, b) => sum + (b.remaining_qty as number), 0);
  return {
    item_type: itemType,
    item_id: itemId,
    name: item.name,
    unit: item.unit,
    current_stock: currentStock,
    reorder_threshold: item.reorder_threshold,
    is_low_stock: isLowStock(currentStock, item.reorder_threshold),
  };
}

interface StockGroupResult {
  _id: { item_type: ItemType; item_id: string };
  current_stock: number;
}

/**
 * Stock levels across every item (optionally filtered to one item_type), grouped from
 * inventory_batches and joined against the right master collection for name/unit/
 * reorder_threshold. Skips groups whose master item was since deleted (don't 500).
 */
export async function computeStockLevels(itemType?: ItemType): Promise<StockLevel[]> {
  const db = await getDb();
  const matchStage: Record<string, unknown> = { remaining_qty: { $gt: 0 } };
  if (itemType) matchStage.item_type = itemType;

  const groups = await db
    .collection(COLLECTIONS.inventoryBatches)
    .aggregate<StockGroupResult>([
      { $match: matchStage },
      { $group: { _id: { item_type: '$item_type', item_id: '$item_id' }, current_stock: { $sum: '$remaining_qty' } } },
    ])
    .toArray();

  // Batch-resolve item name/unit/reorder_threshold per item_type in one round trip each, instead
  // of one query per group.
  const idsByType = new Map<ItemType, string[]>();
  for (const group of groups) {
    const gType = group._id.item_type;
    idsByType.set(gType, [...(idsByType.get(gType) ?? []), group._id.item_id]);
  }
  const itemsByType = new Map<ItemType, Record<string, StockItem>>();
  for (const [gType, ids] of idsByType) {
    itemsByType.set(gType, await findByIds<StockItem>(ITEM_TYPE_COLLECTIONS[gType], ids));
  }

  const results: StockLevel[] = [];
  for (const group of groups) {
    const gType = group._id.item_type;
    const gId = group._id.item_id;
    const item = itemsByType.get(gType)?.[gId];
    if (!item) continue; // batch references an item that's since been deleted — skip, don't 500
    const currentStock = group.current_stock;
    results.push({
      item_type: gType,
      item_id: gId,
      name: item.name,
      unit: item.unit,
      current_stock: currentStock,
      reorder_threshold: item.reorder_threshold,
      is_low_stock: isLowStock(currentStock, item.reorder_threshold),
    });
  }
  return results;
}
