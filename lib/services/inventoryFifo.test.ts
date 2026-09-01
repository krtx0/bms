// Ported verbatim from backend/app/tests/test_fifo_inventory.py — same scenarios, same
// hand-computed numbers, one-to-one.

import { expect, it } from 'vitest';
import { deductFifo, resolveComponentShortfallToIngredients, type FifoBatch } from './inventoryFifo';

// batch A received day 1, batch B day 2, batch C day 3 — pre-sorted oldest-first.
function batches(): FifoBatch[] {
  return [
    { batchId: 'batch-A', remainingQty: 10 },
    { batchId: 'batch-B', remainingQty: 15 },
    { batchId: 'batch-C', remainingQty: 20 },
  ];
}

it('deductFifo partially drains the second batch and leaves the third untouched', () => {
  const input = batches();
  const { deductions, unfulfilledRemainder } = deductFifo(input, 18);

  expect(deductions).toEqual([
    { batchId: 'batch-A', qtyDeducted: 10 },
    { batchId: 'batch-B', qtyDeducted: 8 },
  ]);
  expect(unfulfilledRemainder).toBe(0);
  expect(deductions.reduce((sum, d) => sum + d.qtyDeducted, 0)).toBe(18);
  expect(input).toEqual(batches()); // input array/objects not mutated
});

it('deductFifo drains all batches and reports the shortfall', () => {
  const { deductions, unfulfilledRemainder } = deductFifo(batches(), 50); // only 45 available across all batches

  expect(deductions).toEqual([
    { batchId: 'batch-A', qtyDeducted: 10 },
    { batchId: 'batch-B', qtyDeducted: 15 },
    { batchId: 'batch-C', qtyDeducted: 20 },
  ]);
  expect(unfulfilledRemainder).toBe(5);
});

it('deductFifo zero needed returns no deductions', () => {
  const { deductions, unfulfilledRemainder } = deductFifo(batches(), 0);

  expect(deductions).toEqual([]);
  expect(unfulfilledRemainder).toBe(0);
});

it('deductFifo empty batch list is fully unfulfilled', () => {
  const { deductions, unfulfilledRemainder } = deductFifo([], 5);

  expect(deductions).toEqual([]);
  expect(unfulfilledRemainder).toBe(5);
});

it('resolveComponentShortfallToIngredients scales by shortfall qty', () => {
  // Component needs 2 units of ingredient X and 0.5 units of ingredient Y per unit of itself.
  const lines: [string, number][] = [
    ['ingredient_X', 2],
    ['ingredient_Y', 0.5],
  ];

  const result = resolveComponentShortfallToIngredients(3, lines);

  expect(result).toEqual({ ingredient_X: 6, ingredient_Y: 1.5 });
});
