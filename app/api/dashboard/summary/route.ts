import { requireAuth, unauthorized } from '@/lib/auth';
import { findByIds, getOne } from '@/lib/crud';
import { COLLECTIONS, getDb } from '@/lib/db';
import { computeStockLevels } from '@/lib/services/inventory';
import { addMonths, monthlyGroup, monthStart, sumField } from '@/lib/services/reporting';
import type {
  Component,
  Customer,
  DashboardRecentOrder,
  DashboardRecentPurchase,
  RevenueCostMonth,
  StockLevel,
  Supplier,
  TodayBoard,
  TodayBoardBatchReady,
  TodayBoardLowStockItem,
  TodayBoardOrderRef,
} from '@/types';

// Mirrors backend/app/routers/dashboard.py's GET /summary: one endpoint bundling a handful of
// independent read-side aggregations over orders/purchases/inventory. Nothing here is stored —
// every number is computed fresh on each request, run concurrently via Promise.all since none of
// them depend on each other.

const NOT_DONE = { $nin: ['Delivered', 'Cancelled'] }; // "active" order: not yet delivered, not cancelled

async function outstandingPayments(): Promise<number> {
  const db = await getDb();
  const result = await db
    .collection(COLLECTIONS.orders)
    .aggregate<{ total: number }>([
      { $match: { payment_status: { $ne: 'Fully Paid' } } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$selling_price', '$amount_paid'] } } } },
    ])
    .toArray();
  return result[0]?.total ?? 0;
}

async function recentOrders(): Promise<DashboardRecentOrder[]> {
  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.orders).find().sort({ created_at: -1 }).limit(5).toArray();
  const customersById = await findByIds<Customer>(COLLECTIONS.customers, docs.map((d) => String(d.customer_id)));
  return docs.map((d) => ({
    order_number: d.order_number,
    customer_name: customersById[String(d.customer_id)]?.name ?? null,
    selling_price: d.selling_price,
    status: d.status,
    created_at: d.created_at,
  })) as DashboardRecentOrder[];
}

async function recentPurchases(): Promise<DashboardRecentPurchase[]> {
  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.purchases).find().sort({ purchase_date: -1 }).limit(5).toArray();
  const supplierIds = docs.map((d) => d.supplier_id).filter((id): id is string => Boolean(id));
  const suppliersById = await findByIds<Supplier>(COLLECTIONS.suppliers, supplierIds);
  return docs.map((d) => ({
    purchase_number: d.purchase_number,
    supplier_name: d.supplier_id ? (suppliersById[String(d.supplier_id)]?.name ?? null) : null,
    total_cost: d.total_cost,
    purchase_date: d.purchase_date,
  })) as DashboardRecentPurchase[];
}

// Last 24 calendar months of revenue vs. cost (COGS), paired by month — feeds the dashboard's
// trend chart. Reuses monthlyGroup exactly as the Financial report's cash_flow does, just paired
// against total_product_cost instead of recorded expenses (matches the chart's "cost" framing
// without duplicating the Financial tab's revenue/expenses chart).
async function revenueCostTrend(): Promise<RevenueCostMonth[]> {
  const since = addMonths(monthStart(new Date()), -23);
  const match = { created_at: { $gte: since } };
  const [monthlyRevenue, monthlyCost] = await Promise.all([
    monthlyGroup(COLLECTIONS.orders, match, 'created_at', 'selling_price'),
    monthlyGroup(COLLECTIONS.orders, match, 'created_at', 'total_product_cost'),
  ]);
  const months = [...new Set([...Object.keys(monthlyRevenue), ...Object.keys(monthlyCost)])].sort();
  return months.map((month) => ({ month, revenue: monthlyRevenue[month] ?? 0, cost: monthlyCost[month] ?? 0 }));
}

async function pendingConfirmationBoard(): Promise<{ count: number; orders: TodayBoardOrderRef[] }> {
  const db = await getDb();
  const [count, docs] = await Promise.all([
    db.collection(COLLECTIONS.orders).countDocuments({ status: 'Pending' }),
    db.collection(COLLECTIONS.orders).find({ status: 'Pending' }).sort({ created_at: -1 }).limit(3).toArray(),
  ]);
  const customersById = await findByIds<Customer>(COLLECTIONS.customers, docs.map((d) => String(d.customer_id)));
  return {
    count,
    orders: docs.map((d) => ({ order_number: d.order_number, customer_name: customersById[String(d.customer_id)]?.name ?? null })),
  };
}

async function deliveriesTodayBoard(todayStart: Date, todayEnd: Date): Promise<{ count: number; orders: TodayBoardOrderRef[] }> {
  const db = await getDb();
  const match = { delivery_date: { $gte: todayStart, $lt: todayEnd }, status: NOT_DONE };
  const [count, docs] = await Promise.all([
    db.collection(COLLECTIONS.orders).countDocuments(match),
    db.collection(COLLECTIONS.orders).find(match).sort({ created_at: -1 }).limit(3).toArray(),
  ]);
  const customersById = await findByIds<Customer>(COLLECTIONS.customers, docs.map((d) => String(d.customer_id)));
  return {
    count,
    orders: docs.map((d) => ({ order_number: d.order_number, customer_name: customersById[String(d.customer_id)]?.name ?? null })),
  };
}

// Reuses the SAME computeStockLevels() result the caller already fetched for low_stock_count,
// rather than re-running that aggregation a second time in one request.
function lowStockBoard(stockLevels: StockLevel[]): TodayBoardLowStockItem[] {
  return stockLevels
    .filter((r) => r.is_low_stock)
    .sort((a, b) => b.reorder_threshold - b.current_stock - (a.reorder_threshold - a.current_stock))
    .slice(0, 3)
    .map((r) => ({ name: r.name, unit: r.unit, current_stock: r.current_stock, reorder_threshold: r.reorder_threshold }));
}

// Most recent semi-finished batch logged via a manual stock adjustment (there's no dedicated
// "production complete" event in this schema — StockAdjustModal is the only way semi-finished
// stock is ever added). Null if nothing's been logged yet.
async function batchReadyBoard(): Promise<TodayBoardBatchReady | null> {
  const db = await getDb();
  const batches = await db
    .collection(COLLECTIONS.inventoryBatches)
    .find({ item_type: 'semi_finished', source_type: 'adjustment' })
    .sort({ created_at: -1 })
    .limit(1)
    .toArray();
  if (batches.length === 0) return null;

  const batch = batches[0];
  const component = await getOne<Component>(COLLECTIONS.components, String(batch.item_id));
  if (!component) return null; // component deleted since — nothing sensible to show

  const usedInOrders = await db
    .collection(COLLECTIONS.inventoryMovements)
    .aggregate<{ _id: string }>([
      { $match: { batch_id: String(batch._id), reason: 'order_production' } },
      { $group: { _id: '$reference_id' } },
    ])
    .toArray();

  return {
    item_name: component.name,
    quantity: batch.quantity_received,
    unit: component.unit,
    used_in_orders: usedInOrders.length,
  };
}

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const db = await getDb();
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const thisMonthStart = monthStart(now);
  const nextMonthStart = addMonths(thisMonthStart, 1);
  const lastMonthStart = addMonths(thisMonthStart, -1);

  const [
    orders_today,
    orders_yesterday,
    pending_orders,
    completed_orders_this_month,
    completed_orders_last_month,
    revenue_today,
    revenue_yesterday,
    revenue_this_month,
    revenue_last_month,
    profit_this_month,
    outstanding_payments,
    stockLevels,
    upcoming_deliveries_7d,
    recent_orders,
    recent_purchases,
    revenue_cost_trend,
    pending_confirmation,
    deliveries_today,
    batch_ready,
  ] = await Promise.all([
    db.collection(COLLECTIONS.orders).countDocuments({ created_at: { $gte: todayStart, $lt: todayEnd } }),
    db.collection(COLLECTIONS.orders).countDocuments({ created_at: { $gte: yesterdayStart, $lt: todayStart } }),
    db.collection(COLLECTIONS.orders).countDocuments({ status: NOT_DONE }),
    db
      .collection(COLLECTIONS.orders)
      .countDocuments({ status: 'Delivered', created_at: { $gte: thisMonthStart, $lt: nextMonthStart } }),
    db
      .collection(COLLECTIONS.orders)
      .countDocuments({ status: 'Delivered', created_at: { $gte: lastMonthStart, $lt: thisMonthStart } }),
    // revenue_today = orders PLACED today (by created_at), not orders PAID today — a payment can
    // trickle in days after an order is placed, so "placed today" is the simpler and more
    // defensible reading of "today's revenue", and it's consistent with how
    // revenue_this_month/revenue_last_month are defined below (also by created_at).
    sumField(COLLECTIONS.orders, { created_at: { $gte: todayStart, $lt: todayEnd } }, 'selling_price'),
    sumField(COLLECTIONS.orders, { created_at: { $gte: yesterdayStart, $lt: todayStart } }, 'selling_price'),
    sumField(COLLECTIONS.orders, { created_at: { $gte: thisMonthStart, $lt: nextMonthStart } }, 'selling_price'),
    sumField(COLLECTIONS.orders, { created_at: { $gte: lastMonthStart, $lt: thisMonthStart } }, 'selling_price'),
    sumField(COLLECTIONS.orders, { created_at: { $gte: thisMonthStart, $lt: nextMonthStart } }, 'estimated_profit'),
    outstandingPayments(),
    computeStockLevels(),
    db.collection(COLLECTIONS.orders).countDocuments({
      delivery_date: { $gte: todayStart, $lt: new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
      status: NOT_DONE,
    }),
    recentOrders(),
    recentPurchases(),
    revenueCostTrend(),
    pendingConfirmationBoard(),
    deliveriesTodayBoard(todayStart, todayEnd),
    batchReadyBoard(),
  ]);

  const today_board: TodayBoard = {
    pending_confirmation,
    deliveries_today,
    low_stock: lowStockBoard(stockLevels),
    batch_ready,
  };

  return Response.json({
    orders_today,
    orders_yesterday,
    pending_orders,
    completed_orders_this_month,
    completed_orders_last_month,
    revenue_today,
    revenue_yesterday,
    revenue_this_month,
    revenue_last_month,
    profit_this_month,
    outstanding_payments,
    low_stock_count: stockLevels.filter((r) => r.is_low_stock).length,
    upcoming_deliveries_7d,
    recent_orders,
    recent_purchases,
    revenue_cost_trend,
    today_board,
  });
}
