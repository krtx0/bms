// Shared read-side aggregation helpers behind the dashboard/reports routes: the $group-sum and
// $group-by-month patterns needed repeatedly, the calendar-month math behind date-range
// defaults, and the flavour-breakdown aggregation shared by /api/reports/sales and
// /api/reports/operational — two separate route files in Next.js, unlike backend/app/routers/
// reports.py where both endpoints live in one router module and share a local helper directly.
// Ported from backend/app/services/reporting.py; see lib/services/costing.ts for the actual
// formulas these numbers feed into.

import { findByIds } from '@/lib/crud';
import { COLLECTIONS, getDb } from '@/lib/db';
import type { Recipe } from '@/types';

// Dates are handled in UTC throughout (matching the Python backend's utcnow(), a tz-aware UTC
// datetime) so "today"/"this month" boundaries land on the same instant regardless of server
// timezone, and stay consistent with how every other date in this DB was written (createOne's
// `created_at: new Date()`, etc.).
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/**
 * n can be negative. Unlike the Python source (which has to guard month-add against day-of-month
 * overflow for an arbitrary date), Date.UTC normalizes an out-of-range month on its own — and
 * every caller here only ever passes monthStart's day=1 output through anyway.
 */
export function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

/** date_from/date_to query params -> a half-open [from, to) range, each side defaulting
 * independently to the current calendar month. Mirrors routers/reports.py's _resolve_range. */
export function resolveDateRange(searchParams: URLSearchParams): [Date, Date] {
  const thisMonthStart = monthStart(new Date());
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  return [dateFrom ? new Date(dateFrom) : thisMonthStart, dateTo ? new Date(dateTo) : addMonths(thisMonthStart, 1)];
}

/** Sum of `field` across documents matching `match`. 0 if nothing matches. */
export async function sumField(collection: string, match: Record<string, unknown>, field: string): Promise<number> {
  const db = await getDb();
  const result = await db
    .collection(collection)
    .aggregate<{ total: number }>([{ $match: match }, { $group: { _id: null, total: { $sum: `$${field}` } } }])
    .toArray();
  return result[0]?.total ?? 0;
}

/** {"2026-08": total, ...} bucketed by calendar month (UTC) of `dateField`. sumFieldName omitted
 * counts documents instead of summing a field (used for e.g. monthly order counts). */
export async function monthlyGroup(
  collection: string,
  match: Record<string, unknown>,
  dateField: string,
  sumFieldName?: string
): Promise<Record<string, number>> {
  const db = await getDb();
  const accumulator = sumFieldName ? { $sum: `$${sumFieldName}` } : { $sum: 1 };
  const rows = await db
    .collection(collection)
    .aggregate<{ _id: string; total: number }>([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${dateField}` } }, total: accumulator } },
    ])
    .toArray();
  return Object.fromEntries(rows.map((r) => [r._id, r.total]));
}

/**
 * Shared shape behind best_selling_flavours (sales report) and product_cost_analysis
 * (operational report): $unwind line_items, $group by recipe_id. flavour_code is already
 * snapshotted on the line item (survives recipe renames/deletes) but the display name isn't, so
 * it's resolved via findByIds — falls back to flavour_code if the recipe's since been deleted.
 * No slicing here; callers take the top N or the full list as needed.
 *
 * revenue comes straight from the stored line_total_amount (= selling_price * quantity, set once
 * at order-creation time by orderWorkflow.ts) rather than being recomputed with $multiply — every
 * order in this app was written by that same code path, so unlike the Python source (which has
 * legacy orders predating that field) there's no backfill gap here to work around.
 */
export async function flavourBreakdown(match: Record<string, unknown>, sortField: 'units_sold' | 'avg_product_cost') {
  const db = await getDb();
  const rows = await db
    .collection(COLLECTIONS.orders)
    .aggregate<{ _id: string; flavour_code: string; units_sold: number; revenue: number; avg_product_cost: number }>([
      { $match: match },
      { $unwind: '$line_items' },
      {
        $group: {
          _id: '$line_items.recipe_id',
          flavour_code: { $first: '$line_items.flavour_code' },
          units_sold: { $sum: '$line_items.quantity' },
          revenue: { $sum: '$line_items.line_total_amount' },
          avg_product_cost: { $avg: '$line_items.total_product_cost' },
        },
      },
      { $sort: { [sortField]: -1 } },
    ])
    .toArray();
  const recipesById = await findByIds<Recipe>(COLLECTIONS.recipes, rows.map((r) => String(r._id)));
  return rows.map((r) => ({
    flavour_code: r.flavour_code,
    name: recipesById[String(r._id)]?.name ?? r.flavour_code,
    units_sold: r.units_sold,
    revenue: r.revenue,
    avg_product_cost: r.avg_product_cost,
  }));
}
