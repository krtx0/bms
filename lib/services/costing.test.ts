// Ported verbatim from backend/app/tests/test_costing.py — same hand-computed numbers, same
// assertions, one-to-one.

import { expect, it } from 'vitest';
import {
  calculateCakeCost,
  calculateComponentCostForRecipe,
  calculateComponentUnitCost,
  calculateCustomizationCost,
  calculateEstimatedProfit,
  calculateGrossProfit,
  calculateNetProfit,
  calculateOutstandingBalance,
  calculateProfitMarginPct,
  calculateTotalProductCost,
  determinePaymentStatus,
  isLowStock,
  weightedSum,
  type WeightedLine,
} from './costing';

it('weightedSum', () => {
  expect(weightedSum([[2, 50], [3, 20]])).toBe(160); // 100 + 60
});

it('cake and component cost wrappers delegate to weightedSum', () => {
  const lines: WeightedLine[] = [[2, 50], [3, 20]]; // == 160
  expect(calculateCakeCost(lines)).toBe(160);
  expect(calculateComponentUnitCost(lines)).toBe(160);
  expect(calculateComponentCostForRecipe(lines)).toBe(160);
});

it('total product cost', () => {
  expect(calculateTotalProductCost(200, 150)).toBe(350);
});

it('customization cost', () => {
  expect(calculateCustomizationCost(1000, 800)).toBe(200);
});

it('estimated profit', () => {
  expect(calculateEstimatedProfit(1000, 350)).toBe(650);
});

it('profit margin pct', () => {
  expect(calculateProfitMarginPct(1000, 350)).toBe(65.0);
});

it('profit margin pct zero selling price does not crash', () => {
  expect(calculateProfitMarginPct(0, 350)).toBe(0.0);
});

it('outstanding balance', () => {
  expect(calculateOutstandingBalance(1000, 400)).toBe(600);
});

it('payment status boundaries', () => {
  expect(determinePaymentStatus(1000, 0)).toBe('Pending');
  expect(determinePaymentStatus(1000, 400)).toBe('Partially Paid');
  expect(determinePaymentStatus(1000, 1000)).toBe('Fully Paid');
});

it('gross profit', () => {
  expect(calculateGrossProfit(5000, 2000)).toBe(3000);
});

it('net profit', () => {
  expect(calculateNetProfit(3000, 800)).toBe(2200);
});

it('low stock boundary is inclusive', () => {
  expect(isLowStock(10, 10)).toBe(true);
  expect(isLowStock(11, 10)).toBe(false);
});

it('order level total by summing line items', () => {
  // Simulates what Phase 4's multi-item orders will do: sum each item's total_product_cost.
  // No calculateOrderTotal function exists on purpose — plain sum is the whole story.
  const itemATotal = calculateTotalProductCost(200, 150);
  const itemBTotal = calculateTotalProductCost(130, 50);
  expect(itemATotal).toBe(350);
  expect(itemBTotal).toBe(180);
  expect([itemATotal, itemBTotal].reduce((a, b) => a + b, 0)).toBe(530);
});
