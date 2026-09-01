// Pure FIFO inventory-deduction algorithm — no DB access. Ported verbatim from
// backend/app/services/inventory_fifo.py so the numbers are auditable against the original
// Python (same order of operations, same edge cases).

export interface FifoBatch {
  batchId: string;
  remainingQty: number;
}

export interface FifoDeduction {
  batchId: string;
  qtyDeducted: number;
}

export interface FifoResult {
  deductions: FifoDeduction[];
  unfulfilledRemainder: number;
}

/**
 * sortedBatches must already be sorted oldest-received first. Returns deductions for whichever
 * batches got consumed (batches with qtyDeducted === 0 are skipped, not included) and
 * unfulfilledRemainder = whatever qtyNeeded couldn't be covered by any batch (0 if fully
 * covered). Does not mutate the input array/objects.
 */
export function deductFifo(sortedBatches: FifoBatch[], qtyNeeded: number): FifoResult {
  const deductions: FifoDeduction[] = [];
  let remainingNeed = qtyNeeded;
  for (const batch of sortedBatches) {
    if (remainingNeed <= 0) break;
    const available = batch.remainingQty;
    if (available <= 0) continue;
    const take = Math.min(available, remainingNeed);
    deductions.push({ batchId: batch.batchId, qtyDeducted: take });
    remainingNeed -= take;
  }
  return { deductions, unfulfilledRemainder: Math.max(remainingNeed, 0) };
}

/**
 * componentIngredientLines: [ingredientId, qtyPerUnitOfComponent][] — how much of each raw
 * ingredient ONE unit of this component needs. shortfallQty is how many units of the component
 * are still needed after semi-finished stock ran out. Returns {ingredientId: qtyNeeded} scaled
 * by shortfallQty — "if we have to make up N missing units of this component from scratch,
 * here's the raw-ingredient bill." A later phase feeds this into deductFifo per-ingredient
 * against raw ingredient batches.
 */
export function resolveComponentShortfallToIngredients(
  shortfallQty: number,
  componentIngredientLines: [ingredientId: string, qtyPerUnit: number][]
): Record<string, number> {
  return Object.fromEntries(
    componentIngredientLines.map(([ingredientId, qtyPerUnit]) => [ingredientId, qtyPerUnit * shortfallQty])
  );
}
