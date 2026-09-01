'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Topbar } from '@/components/layout/Topbar';
import { StatCard } from '@/components/StatCard';
import { Icon, type IconName } from '@/components/Icon';
import { useApiResource } from '@/hooks/useApiResource';
import { formatCurrency } from '@/lib/currency';
import { statusPillClass } from '@/lib/orderStatus';
import type { DashboardSummary, TodayBoard } from '@/types';

// Ported from frontend/src/pages/DashboardPage.tsx.

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

// undefined (not null) so it composes directly with StatCard's optional `trend` prop.
function pctChange(current: number, previous: number): number | undefined {
  return previous > 0 ? ((current - previous) / previous) * 100 : undefined;
}

export default function DashboardPage() {
  const { data, loading, error } = useApiResource<DashboardSummary>('/api/dashboard/summary');

  if (loading && !data) {
    return (
      <>
        <Topbar title="Operations Dashboard" subtitle={`Today · ${todayLabel()}`} />
        <div className="page-content">
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Topbar title="Operations Dashboard" subtitle={`Today · ${todayLabel()}`} />
        <div className="page-content">
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error ?? 'Something went wrong'}
          </div>
        </div>
      </>
    );
  }

  const ordersTrend = pctChange(data.orders_today, data.orders_yesterday);
  const revenueTodayTrend = pctChange(data.revenue_today, data.revenue_yesterday);
  const completedTrend = pctChange(data.completed_orders_this_month, data.completed_orders_last_month);
  const revenueMonthTrend = pctChange(data.revenue_this_month, data.revenue_last_month);

  return (
    <>
      <Topbar title="Operations Dashboard" subtitle={`Today · ${todayLabel()}`} />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label="Orders Today" value={String(data.orders_today)} icon="orders" tone="blue" trend={ordersTrend} />
          <StatCard label="Pending Orders" value={String(data.pending_orders)} icon="orders" tone="tan" />
          <StatCard
            label="Completed (This Month)"
            value={String(data.completed_orders_this_month)}
            icon="invoices"
            tone="green"
            trend={completedTrend}
          />
          <StatCard
            label="Revenue Today"
            value={formatCurrency(data.revenue_today)}
            icon="profit"
            tone="green"
            trend={revenueTodayTrend}
          />
          <StatCard
            label="Revenue This Month"
            value={formatCurrency(data.revenue_this_month)}
            icon="profit"
            tone="green"
            trend={revenueMonthTrend}
          />
          <StatCard label="Outstanding Payments" value={formatCurrency(data.outstanding_payments)} icon="invoices" tone="red" />
          <Link href="/inventory" style={{ textDecoration: 'none', color: 'inherit' }}>
            <StatCard label="Inventory Alerts" value={String(data.low_stock_count)} icon="inventory" tone="red" hint="View in Inventory →" />
          </Link>
          <StatCard label="Upcoming Deliveries (7d)" value={String(data.upcoming_deliveries_7d)} icon="packaging" tone="blue" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 24, overflowX: 'auto' }}>
          <RevenueTrendChart data={data.revenue_cost_trend} />
          <TodaysBoard board={data.today_board} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, overflowX: 'auto' }}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Recent Orders</h3>
            {data.recent_orders.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>No orders yet.</p>
            ) : (
              <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--color-text-secondary)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Order #</th>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Customer</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
                    <th style={{ textAlign: 'left', padding: '4px 0 4px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_orders.map((o) => (
                    <tr key={o.order_number}>
                      <td style={{ padding: '6px 0' }}>{o.order_number}</td>
                      <td>{o.customer_name}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(o.selling_price)}</td>
                      <td style={{ padding: '6px 0 6px 12px' }}>
                        <span className={`pill ${statusPillClass(o.status)}`}>{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Recent Purchases</h3>
            {data.recent_purchases.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>No purchases yet.</p>
            ) : (
              <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--color-text-secondary)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Purchase #</th>
                    <th style={{ textAlign: 'left', padding: '4px 0' }}>Supplier</th>
                    <th style={{ textAlign: 'right', padding: '4px 0' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_purchases.map((p) => (
                    <tr key={p.purchase_number}>
                      <td style={{ padding: '6px 0' }}>{p.purchase_number}</td>
                      <td>{p.supplier_name ?? '—'}</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(p.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------- Revenue & cost trend ----------------------------
// Fetches once (up to 24 months, from /api/dashboard/summary); the 7M/1Y/All toggle is a pure
// client-side slice of that same array, no refetch per click.

type Range = '7M' | '1Y' | 'All';
const RANGE_MONTHS: Record<Range, number | null> = { '7M': 7, '1Y': 12, All: null };

function RevenueTrendChart({ data }: { data: { month: string; revenue: number; cost: number }[] }) {
  const [range, setRange] = useState<Range>('7M');
  const months = RANGE_MONTHS[range];
  const visible = months ? data.slice(-months) : data;

  const netChangePct = (() => {
    if (visible.length < 2) return null;
    const first = visible[0].revenue - visible[0].cost;
    const last = visible[visible.length - 1].revenue - visible[visible.length - 1].cost;
    return first !== 0 ? ((last - first) / Math.abs(first)) * 100 : null;
  })();

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 15 }}>Revenue &amp; cost trend</h3>
          <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {netChangePct === null
              ? `Last ${visible.length} month${visible.length === 1 ? '' : 's'}`
              : `Last ${visible.length} months — net contribution ${netChangePct >= 0 ? 'growing' : 'shrinking'} ${Math.abs(netChangePct).toFixed(1)}%`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(RANGE_MONTHS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className={range === r ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setRange(r)}
              style={{ padding: '5px 12px', fontSize: 12.5 }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>No orders yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={visible}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sidebar-bg)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-sidebar-bg)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent-gold)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-accent-gold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" stroke="var(--color-text-secondary)" fontSize={12} />
            <YAxis stroke="var(--color-text-secondary)" fontSize={12} width={85} tickFormatter={(v) => formatCurrency(Number(v))} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)' }} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="var(--color-sidebar-bg)"
              fill="url(#revenueFill)"
              strokeWidth={2.5}
            />
            <Area type="monotone" dataKey="cost" name="Cost" stroke="var(--color-accent-gold)" fill="url(#costFill)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// -------------------------------- Today's board --------------------------------
// An "attention needed" digest: orders awaiting confirmation, today's deliveries, low stock, and
// the most recent semi-finished batch logged. All four numbers/lists come straight off
// /api/dashboard/summary — nothing client-computed here beyond picking what copy to show.

function TodaysBoard({ board }: { board: TodayBoard }) {
  const cards: { icon: IconName; title: string; subtitle: string }[] = [];

  if (board.pending_confirmation.count > 0) {
    const names = board.pending_confirmation.orders.map((o) => o.customer_name).filter(Boolean);
    cards.push({
      icon: 'bell',
      title: `${board.pending_confirmation.count} order${board.pending_confirmation.count === 1 ? '' : 's'} awaiting confirmation`,
      subtitle: names.length > 0 ? names.join(', ') : board.pending_confirmation.orders.map((o) => o.order_number).join(', '),
    });
  }

  if (board.deliveries_today.count > 0) {
    cards.push({
      icon: 'packaging',
      title: `${board.deliveries_today.count} deliver${board.deliveries_today.count === 1 ? 'y' : 'ies'} scheduled today`,
      subtitle: board.deliveries_today.orders.map((o) => o.order_number).join(', '),
    });
  }

  for (const item of board.low_stock) {
    cards.push({
      icon: 'inventory',
      title: `Low stock: ${item.name}`,
      subtitle: `${item.current_stock} / ${item.reorder_threshold} ${item.unit}`,
    });
  }

  if (board.batch_ready) {
    cards.push({
      icon: 'semiFinished',
      title: `${board.batch_ready.item_name} batch ready`,
      subtitle: `${board.batch_ready.quantity} ${board.batch_ready.unit} · used in ${board.batch_ready.used_in_orders} order${board.batch_ready.used_in_orders === 1 ? '' : 's'}`,
    });
  }

  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ fontSize: 15, marginBottom: 16 }}>Today&apos;s board</h3>
      {cards.length === 0 ? (
        <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)' }}>Nothing needs attention right now.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'var(--color-tan-bg)',
                  color: 'var(--color-tan-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={c.icon} size={15} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.subtitle}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
