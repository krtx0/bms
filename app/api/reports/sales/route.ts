import { requireAuth, unauthorized } from '@/lib/auth';
import { findByIds } from '@/lib/crud';
import { COLLECTIONS, getDb } from '@/lib/db';
import { flavourBreakdown, monthlyGroup, resolveDateRange } from '@/lib/services/reporting';
import type { Customer, MonthlySales, TopCustomer } from '@/types';

async function topCustomers(match: Record<string, unknown>): Promise<TopCustomer[]> {
  const db = await getDb();
  const rows = await db
    .collection(COLLECTIONS.orders)
    .aggregate<{ _id: string; total_spent: number; order_count: number }>([
      { $match: match },
      { $group: { _id: '$customer_id', total_spent: { $sum: '$selling_price' }, order_count: { $sum: 1 } } },
      { $sort: { total_spent: -1 } },
      { $limit: 10 },
    ])
    .toArray();
  const customersById = await findByIds<Customer>(COLLECTIONS.customers, rows.map((r) => String(r._id)));
  return rows.map((r) => ({
    customer_id: String(r._id),
    name: customersById[String(r._id)]?.name ?? 'Unknown',
    total_spent: r.total_spent,
    order_count: r.order_count,
  }));
}

// Mirrors backend/app/routers/reports.py's GET /sales.
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const [dateFrom, dateTo] = resolveDateRange(searchParams);
  const orderMatch = { created_at: { $gte: dateFrom, $lt: dateTo } };

  const [monthlyRevenue, monthlyOrderCounts, flavours, top_customers] = await Promise.all([
    monthlyGroup(COLLECTIONS.orders, orderMatch, 'created_at', 'selling_price'),
    monthlyGroup(COLLECTIONS.orders, orderMatch, 'created_at'), // no sum field -> counts orders per month
    flavourBreakdown(orderMatch, 'units_sold'),
    topCustomers(orderMatch),
  ]);

  const months = [...new Set([...Object.keys(monthlyRevenue), ...Object.keys(monthlyOrderCounts)])].sort();
  const monthly_sales: MonthlySales[] = months.map((month) => ({
    month,
    revenue: monthlyRevenue[month] ?? 0,
    order_count: monthlyOrderCounts[month] ?? 0,
  }));

  const best_selling_flavours = flavours.slice(0, 10).map((f) => ({
    flavour_code: f.flavour_code,
    name: f.name,
    units_sold: f.units_sold,
    revenue: f.revenue,
  }));

  return Response.json({ monthly_sales, best_selling_flavours, top_customers });
}
