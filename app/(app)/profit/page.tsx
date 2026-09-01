'use client';

import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Topbar } from '@/components/layout/Topbar';
import { StatCard } from '@/components/StatCard';
import { DataTable } from '@/components/DataTable';
import { FormModal, FormField } from '@/components/FormModal';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/currency';
import type { Expense, FinancialReport, OperationalReport, SalesReport } from '@/types';

// Ported from frontend/src/pages/reports/ProfitDashboardPage.tsx.

function todayInputDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function reportQuery(dateFrom: string, dateTo: string): string {
  const params = new URLSearchParams();
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function LoadingCard() {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
      Loading…
    </div>
  );
}

function ErrorCard({ message }: { message?: string | null }) {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
      {message ?? 'Something went wrong'}
    </div>
  );
}

type Tab = 'financial' | 'sales' | 'operational' | 'expenses';
const TABS: { key: Tab; label: string }[] = [
  { key: 'financial', label: 'Financial' },
  { key: 'sales', label: 'Sales' },
  { key: 'operational', label: 'Operational' },
  { key: 'expenses', label: 'Expenses' },
];

export default function ProfitDashboardPage() {
  const [tab, setTab] = useState<Tab>('financial');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  return (
    <>
      <Topbar title="Profit Dashboard" subtitle="Financial, sales & operational reports" />
      <div className="page-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button key={t.key} className={tab === t.key ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Shared by Financial/Sales/Operational (all three accept the same date_from/date_to);
              Expenses is plain CRUD with no date filter on the backend, so this is simply inert
              on that tab rather than hidden — one less conditional to maintain. */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
                style={{ fontSize: 13, padding: '8px 12px' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {tab === 'financial' && <FinancialTab dateFrom={dateFrom} dateTo={dateTo} />}
        {tab === 'sales' && <SalesTab dateFrom={dateFrom} dateTo={dateTo} />}
        {tab === 'operational' && <OperationalTab dateFrom={dateFrom} dateTo={dateTo} />}
        {tab === 'expenses' && <ExpensesTab />}
      </div>
    </>
  );
}

// ------------------------------- Financial tab -------------------------------

function FinancialTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, loading, error } = useApiResource<FinancialReport>(`/api/reports/financial${reportQuery(dateFrom, dateTo)}`);

  if (loading && !data) return <LoadingCard />;
  if (error || !data) return <ErrorCard message={error} />;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Revenue" value={formatCurrency(data.revenue)} icon="profit" />
        <StatCard label="COGS" value={formatCurrency(data.cogs)} icon="costing" />
        <StatCard label="Gross Profit" value={formatCurrency(data.gross_profit)} icon="profit" />
        <StatCard label="Expenses" value={formatCurrency(data.expenses)} icon="invoices" />
        <StatCard label="Net Profit" value={formatCurrency(data.net_profit)} icon="profit" />
      </div>

      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Cash Flow</h3>
        {data.cash_flow.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>No cash flow data for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.cash_flow}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} />
              <YAxis stroke="var(--color-text-secondary)" fontSize={12} width={85} tickFormatter={(v) => formatCurrency(Number(v))} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)' }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Revenue" stroke="var(--color-sidebar-bg)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="var(--color-accent-gold)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

// --------------------------------- Sales tab ----------------------------------

function SalesTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, loading, error } = useApiResource<SalesReport>(`/api/reports/sales${reportQuery(dateFrom, dateTo)}`);

  if (loading && !data) return <LoadingCard />;
  if (error || !data) return <ErrorCard message={error} />;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, marginBottom: 20, overflowX: 'auto' }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Best-Selling Flavours (by revenue)</h3>
          {data.best_selling_flavours.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>No sales in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, data.best_selling_flavours.length * 40)}>
              <BarChart data={data.best_selling_flavours} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={(v) => formatCurrency(Number(v))} />
                <YAxis type="category" dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} width={130} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)' }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-sidebar-bg)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Monthly Sales</h3>
          {data.monthly_sales.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>No sales in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.monthly_sales}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} />
                <YAxis stroke="var(--color-text-secondary)" fontSize={12} width={85} tickFormatter={(v) => formatCurrency(Number(v))} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)' }} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="var(--color-sidebar-bg)"
                  fill="var(--color-sidebar-bg)"
                  fillOpacity={0.18}
                  strokeWidth={2.5}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <DataTable
        rows={data.top_customers}
        keyField="customer_id"
        emptyMessage="No customer data in this range."
        columns={[
          { key: 'name', header: 'Customer' },
          { key: 'total_spent', header: 'Total Spent', align: 'right', render: (r) => formatCurrency(r.total_spent) },
          { key: 'order_count', header: 'Orders', align: 'right' },
        ]}
      />
    </>
  );
}

// ------------------------------ Operational tab -------------------------------

function OperationalTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const { data, loading, error } = useApiResource<OperationalReport>(`/api/reports/operational${reportQuery(dateFrom, dateTo)}`);

  if (loading && !data) return <LoadingCard />;
  if (error || !data) return <ErrorCard message={error} />;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard label="Low Stock Items" value={String(data.inventory_summary.low_stock_count)} icon="inventory" />
        <StatCard label="Purchase Spend" value={formatCurrency(data.purchase_summary.total_spend)} icon="purchases" />
        <StatCard label="Purchases Made" value={String(data.purchase_summary.purchase_count)} icon="purchases" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, overflowX: 'auto' }}>
        <DataTable
          rows={data.product_cost_analysis}
          keyField="flavour_code"
          emptyMessage="No production data in this range."
          columns={[
            { key: 'flavour_code', header: 'Code' },
            { key: 'name', header: 'Flavour' },
            { key: 'avg_product_cost', header: 'Avg Cost', align: 'right', render: (r) => formatCurrency(r.avg_product_cost) },
            { key: 'units_sold', header: 'Units Sold', align: 'right' },
          ]}
        />

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Purchase Spend by Category</h3>
          {data.purchase_summary.by_category.length === 0 ? (
            <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>No purchases in this range.</p>
          ) : (
            <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--color-text-secondary)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Category</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.purchase_summary.by_category.map((c) => (
                  <tr key={c.category}>
                    <td style={{ padding: '6px 0' }}>{c.category}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(c.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

// -------------------------------- Expenses tab --------------------------------
// The one place in the app Expenses gets a UI (backend is plain CRUD, folded into Reports
// per the phase plan) — create + list only, no edit/delete UI since none was asked for.

interface ExpenseFormState {
  expense_date: string;
  category: string;
  amount: number;
  notes: string;
}

const EMPTY_EXPENSE_FORM: ExpenseFormState = { expense_date: todayInputDate(), category: '', amount: 0, notes: '' };

function ExpensesTab() {
  const { data: expenses, loading, error, reload } = useApiResource<Expense[]>('/api/expenses');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(EMPTY_EXPENSE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function openCreate() {
    setForm(EMPTY_EXPENSE_FORM);
    setFormError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setFormError('');
    try {
      await api.post('/api/expenses', {
        expense_date: new Date(form.expense_date).toISOString(),
        category: form.category,
        amount: form.amount,
        notes: form.notes,
      });
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={openCreate}>
          + New expense
        </button>
      </div>

      {loading && !expenses ? (
        <LoadingCard />
      ) : error ? (
        <ErrorCard message={error} />
      ) : (
        <DataTable
          rows={expenses ?? []}
          keyField="id"
          searchPlaceholder="Search expenses…"
          emptyMessage="No expenses yet."
          columns={[
            { key: 'expense_date', header: 'Date', render: (r) => new Date(r.expense_date).toLocaleDateString() },
            { key: 'category', header: 'Category', render: (r) => <span className="pill pill-tan">{r.category}</span> },
            { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
            { key: 'notes', header: 'Notes', render: (r) => r.notes || '—' },
          ]}
        />
      )}

      <FormModal
        open={open}
        title="New expense"
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Add expense"
      >
        <FormField label="Date">
          <input
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            required
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Category">
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Rent & Utility, Salary, Cartage…"
            required
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Amount (₹)">
          <input
            type="number"
            min={0}
            step="any"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
            required
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </FormField>

        {formError && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{formError}</p>}
      </FormModal>
    </>
  );
}
