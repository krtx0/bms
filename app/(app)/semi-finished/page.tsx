'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { StockAdjustModal, type StockAdjustTarget } from '@/components/StockAdjustModal';
import { useApiResource } from '@/hooks/useApiResource';
import type { Component, StockLevel } from '@/types';

// Stock view for semi-finished items (components prepared in-house). Component master-data CRUD
// lives on the Recipes & Components page — this page only shows live stock, mirroring
// MaterialPage's stock join + Adjust action. Ported from
// frontend/src/pages/production/SemiFinishedPage.tsx.
export default function SemiFinishedPage() {
  const { data: components, loading, error, reload } = useApiResource<Component[]>('/api/components');
  const { data: stockLevels, reload: reloadStock } = useApiResource<StockLevel[]>(
    '/api/inventory/stock-levels?item_type=semi_finished'
  );
  const [adjustTarget, setAdjustTarget] = useState<StockAdjustTarget | null>(null);

  // Components with no batches yet don't get a stock-levels row at all — treat as zero stock.
  const stockByItemId = Object.fromEntries((stockLevels ?? []).map((s) => [s.item_id, s]));

  return (
    <>
      <Topbar title="Semi-Finished" subtitle="Prepared-in-house stock" />
      <div className="page-content">
        {loading && !components ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : error ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            rows={components ?? []}
            keyField="id"
            searchPlaceholder="Search semi-finished items…"
            emptyMessage="No components yet — add one from Recipes & Components."
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'unit', header: 'Unit' },
              {
                key: 'current_stock',
                header: 'Current Stock',
                align: 'right',
                render: (r) => `${stockByItemId[r.id]?.current_stock ?? 0} ${r.unit}`,
              },
              {
                key: 'stock_status',
                header: 'Status',
                render: (r) => (stockByItemId[r.id]?.is_low_stock ? <span className="pill pill-red">LOW</span> : null),
              },
              {
                key: 'adjust',
                header: '',
                render: (r) => (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAdjustTarget({ item_type: 'semi_finished', item_id: r.id, name: r.name, unit: r.unit });
                    }}
                    style={{ padding: '6px 12px', fontSize: 12.5 }}
                  >
                    Adjust
                  </button>
                ),
              },
            ]}
          />
        )}
      </div>

      <StockAdjustModal
        target={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onAdjusted={() => {
          reload();
          reloadStock();
        }}
      />
    </>
  );
}
