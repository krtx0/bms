'use client';

import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { StatCard } from '@/components/StatCard';
import { useRecipesWithCost } from '@/hooks/useRecipeCosts';
import { formatCurrency } from '@/lib/currency';

function marginPillClass(pct: number): string {
  if (pct > 50) return 'pill-green';
  if (pct >= 20) return 'pill-tan';
  return 'pill-red';
}

export default function CostingPage() {
  const { recipes, costs, loading, error } = useRecipesWithCost();

  const rows = (recipes ?? []).map((r) => ({ ...r, cost: costs[r.id] }));
  const withCost = rows.filter((r) => r.cost);
  const avgMargin = withCost.length ? withCost.reduce((sum, r) => sum + r.cost.profit_margin_pct, 0) / withCost.length : 0;
  const cheapest = withCost.length
    ? withCost.reduce((a, b) => (a.cost.total_product_cost < b.cost.total_product_cost ? a : b))
    : null;

  return (
    <>
      <Topbar title="Costing & Pricing" subtitle="Ingredient → component → product cost rollups with live margin" />
      <div className="page-content">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <StatCard label="Total Recipes" value={String(recipes?.length ?? 0)} icon="recipes" />
          <StatCard
            label="Average Margin"
            value={`${avgMargin.toFixed(1)}%`}
            icon="profit"
            hint={`across ${withCost.length} costed recipe${withCost.length === 1 ? '' : 's'}`}
          />
          <StatCard
            label="Cheapest to Make"
            value={cheapest ? cheapest.name : '—'}
            icon="costing"
            hint={cheapest ? formatCurrency(cheapest.cost.total_product_cost) : undefined}
          />
        </div>

        {loading && !recipes ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : error ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            rows={rows}
            keyField="id"
            searchPlaceholder="Search flavours…"
            emptyMessage="No recipes yet."
            columns={[
              { key: 'flavour_code', header: 'Flavour' },
              { key: 'name', header: 'Name' },
              { key: 'sell', header: 'Sell', align: 'right', render: (r) => formatCurrency(r.base_cake_price) },
              {
                key: 'cost',
                header: 'Cost',
                align: 'right',
                render: (r) => (r.cost ? formatCurrency(r.cost.total_product_cost) : '…'),
              },
              {
                key: 'margin',
                header: 'Margin',
                align: 'right',
                render: (r) =>
                  r.cost ? (
                    <span className={`pill ${marginPillClass(r.cost.profit_margin_pct)}`}>{r.cost.profit_margin_pct.toFixed(1)}%</span>
                  ) : (
                    '…'
                  ),
              },
            ]}
          />
        )}
      </div>
    </>
  );
}
