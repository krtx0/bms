import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS } from '@/lib/db';
import { calculateGrossProfit, calculateNetProfit } from '@/lib/services/costing';
import { monthlyGroup, resolveDateRange, sumField } from '@/lib/services/reporting';
import type { CashFlowMonth } from '@/types';

// Mirrors backend/app/routers/reports.py's GET /financial.
export async function GET(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(request.url);
  const [dateFrom, dateTo] = resolveDateRange(searchParams);
  const orderMatch = { created_at: { $gte: dateFrom, $lt: dateTo } }; // created_at, consistent with dashboard.py
  const expenseMatch = { expense_date: { $gte: dateFrom, $lt: dateTo } };

  const [revenue, cogs, expenses, monthlyRevenue, monthlyExpenses] = await Promise.all([
    sumField(COLLECTIONS.orders, orderMatch, 'selling_price'),
    sumField(COLLECTIONS.orders, orderMatch, 'total_product_cost'),
    sumField(COLLECTIONS.expenses, expenseMatch, 'amount'),
    monthlyGroup(COLLECTIONS.orders, orderMatch, 'created_at', 'selling_price'),
    monthlyGroup(COLLECTIONS.expenses, expenseMatch, 'expense_date', 'amount'),
  ]);
  const grossProfit = calculateGrossProfit(revenue, cogs);
  const netProfit = calculateNetProfit(grossProfit, expenses);

  const months = [...new Set([...Object.keys(monthlyRevenue), ...Object.keys(monthlyExpenses)])].sort();
  const cash_flow: CashFlowMonth[] = months.map((month) => ({
    month,
    revenue: monthlyRevenue[month] ?? 0,
    expenses: monthlyExpenses[month] ?? 0,
  }));

  return Response.json({
    revenue,
    cogs,
    gross_profit: grossProfit,
    expenses,
    net_profit: netProfit,
    cash_flow,
  });
}
