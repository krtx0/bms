import { requireAuth, unauthorized } from '@/lib/auth';
import { findByIds } from '@/lib/crud';
import { COLLECTIONS, getDb } from '@/lib/db';
import { computeStockLevels, ITEM_TYPE_COLLECTIONS } from '@/lib/services/inventory';
import { flavourBreakdown, resolveDateRange } from '@/lib/services/reporting';
import type { MaterialItem, ProductCostAnalysis, PurchaseCategoryTotal, PurchaseLineItem } from '@/types';

async function purchaseSummary(
  match: Record<string, unknown>
): Promise<{ total_spend: number; purchase_count: number; by_category: PurchaseCategoryTotal[] }> {
  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.purchases).find(match).toArray();

  const idsByType = new Map<'ingredient' | 'packaging', Set<string>>();
  for (const doc of docs) {
    for (const line of doc.line_items as PurchaseLineItem[]) {
      const ids = idsByType.get(line.item_type) ?? new Set<string>();
      ids.add(String(line.item_id));
      idsByType.set(line.item_type, ids);
    }
  }
  const itemsByType = new Map<'ingredient' | 'packaging', Record<string, MaterialItem>>();
  for (const [itemType, ids] of idsByType) {
    itemsByType.set(itemType, await findByIds<MaterialItem>(ITEM_TYPE_COLLECTIONS[itemType], [...ids]));
  }

  const categoryTotals = new Map<string, number>();
  for (const doc of docs) {
    for (const line of doc.line_items as PurchaseLineItem[]) {
      const item = itemsByType.get(line.item_type)?.[String(line.item_id)];
      const category = item?.category || 'Uncategorized';
      categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + line.quantity * line.unit_cost);
    }
  }
  const by_category = [...categoryTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, total]) => ({ category, total }));

  return {
    total_spend: docs.reduce((sum, d) => sum + (d.total_cost as number), 0),
    purchase_count: docs.length,
    by_category,
  };
}

// Mirrors backend/app/routers/reports.py's GET /operational.
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const [dateFrom, dateTo] = resolveDateRange(searchParams);
  const orderMatch = { created_at: { $gte: dateFrom, $lt: dateTo } };
  const purchaseMatch = { purchase_date: { $gte: dateFrom, $lt: dateTo } };

  const [flavours, stockRows, purchase_summary] = await Promise.all([
    flavourBreakdown(orderMatch, 'avg_product_cost'),
    computeStockLevels(),
    purchaseSummary(purchaseMatch),
  ]);

  const product_cost_analysis: ProductCostAnalysis[] = flavours.map((f) => ({
    flavour_code: f.flavour_code,
    name: f.name,
    avg_product_cost: f.avg_product_cost,
    units_sold: f.units_sold,
  }));
  const lowStockRows = stockRows.filter((r) => r.is_low_stock);

  return Response.json({
    product_cost_analysis,
    inventory_summary: { low_stock_count: lowStockRows.length, items: lowStockRows },
    purchase_summary,
  });
}
