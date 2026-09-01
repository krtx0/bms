// Pure costing/pricing formulas — no DB access, no async. Every function here is a direct,
// verbatim port of backend/app/services/costing.py so the numbers are auditable against the
// original Python (same formulas, same edge cases — e.g. calculateProfitMarginPct returns 0
// when sellingPrice is 0, isLowStock is inclusive <=).
//
// Naming: snake_case Python names become camelCase 1:1, e.g. calculate_cake_cost ->
// calculateCakeCost, is_low_stock -> isLowStock, weighted_sum -> weightedSum.
//
// Phase 4 (orders/payments/reporting) will use the functions below the cake/component ones,
// unchanged, even though nothing calls them yet — they're implemented now because they're
// trivial and testable today (matches the Python source's own note).

export type WeightedLine = [qty: number, unitCost: number];

/** Sum(qty * unitCost). Shared primitive behind cake cost and component cost. */
export function weightedSum(lines: WeightedLine[]): number {
  return lines.reduce((sum, [qty, unitCost]) => sum + qty * unitCost, 0);
}

/** weightedSum of a recipe's direct ingredients. */
export function calculateCakeCost(baseIngredientLines: WeightedLine[]): number {
  return weightedSum(baseIngredientLines);
}

/** weightedSum of one component's own ingredient list — cost to produce ONE unit of that component. */
export function calculateComponentUnitCost(componentIngredientLines: WeightedLine[]): number {
  return weightedSum(componentIngredientLines);
}

/** recipeComponentLines is [(qtyPerUnit, componentUnitCost), ...] — weightedSum across a recipe's components. */
export function calculateComponentCostForRecipe(recipeComponentLines: WeightedLine[]): number {
  return weightedSum(recipeComponentLines);
}

/** = cakeCost + componentCost. Doc formula, verbatim — do not add other terms. */
export function calculateTotalProductCost(cakeCost: number, componentCost: number): number {
  return cakeCost + componentCost;
}

/** = sellingPrice - baseCakePrice. Doc formula, verbatim. */
export function calculateCustomizationCost(sellingPrice: number, baseCakePrice: number): number {
  return sellingPrice - baseCakePrice;
}

/** = sellingPrice - totalProductCost. */
export function calculateEstimatedProfit(sellingPrice: number, totalProductCost: number): number {
  return sellingPrice - totalProductCost;
}

/**
 * = (sellingPrice - totalCost) / sellingPrice * 100. Returns 0 if sellingPrice === 0 (not a
 * crash, not Infinity/NaN).
 *
 * Also used, unchanged, as "Gross Margin %" in the Costing & Pricing UI — that's a reused
 * label, not a second formula.
 */
export function calculateProfitMarginPct(sellingPrice: number, totalCost: number): number {
  if (sellingPrice === 0) return 0;
  return ((sellingPrice - totalCost) / sellingPrice) * 100;
}

/** = sellingPrice - amountPaid. */
export function calculateOutstandingBalance(sellingPrice: number, amountPaid: number): number {
  return sellingPrice - amountPaid;
}

/** amountPaid <= 0 -> Pending; >= sellingPrice -> Fully Paid; else Partially Paid. */
export function determinePaymentStatus(sellingPrice: number, amountPaid: number): string {
  if (amountPaid <= 0) return 'Pending';
  if (amountPaid >= sellingPrice) return 'Fully Paid';
  return 'Partially Paid';
}

/** = revenue - cogs. */
export function calculateGrossProfit(revenue: number, cogs: number): number {
  return revenue - cogs;
}

/** = grossProfit - expenses. */
export function calculateNetProfit(grossProfit: number, expenses: number): number {
  return grossProfit - expenses;
}

/** = currentStock <= reorderThreshold. Inclusive — a stock level exactly AT the threshold counts as low. */
export function isLowStock(currentStock: number, reorderThreshold: number): boolean {
  return currentStock <= reorderThreshold;
}
