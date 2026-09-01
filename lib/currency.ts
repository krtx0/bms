export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    // Whole-rupee figures (order totals, revenue) stay clean with no decimals; per-unit costs
    // for bulk ingredients (₹0.06/g is a completely normal flour price) need the precision, or
    // they render as a flat "₹0" — every value below 50 paise did, before this fix.
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
