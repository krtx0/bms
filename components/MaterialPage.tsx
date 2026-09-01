'use client';

import { useState } from 'react';
import { Topbar } from './layout/Topbar';
import { DataTable } from './DataTable';
import { FormModal, FormField } from './FormModal';
import { Icon } from './Icon';
import { StockAdjustModal, type StockAdjustTarget } from './StockAdjustModal';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/currency';
import type { MaterialItem, StockLevel, Supplier } from '@/types';

interface FormState {
  name: string;
  unit: string;
  current_cost_per_unit: number;
  reorder_threshold: number;
  category: string;
  supplier_id: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  unit: '',
  current_cost_per_unit: 0,
  reorder_threshold: 0,
  category: '',
  supplier_id: '',
};

// Shared implementation for the Inventory (ingredients) and Packaging pages — the backend gives
// both an identical shape, so one CRUD page does both. Also joins in live stock levels
// (/api/inventory/stock-levels) and a manual stock-adjustment action, keyed off the itemType
// prop (ported from frontend/src/pages/production/MaterialPage.tsx, Phase 3).
export function MaterialPage({
  apiPath,
  itemType,
  title,
  subtitle,
  itemLabel,
}: {
  apiPath: string;
  itemType: 'ingredient' | 'packaging';
  title: string;
  subtitle: string;
  itemLabel: string;
}) {
  const { data: items, loading, error: loadError, reload } = useApiResource<MaterialItem[]>(apiPath);
  const { data: suppliers } = useApiResource<Supplier[]>('/api/suppliers');
  const { data: stockLevels, reload: reloadStock } = useApiResource<StockLevel[]>(
    `/api/inventory/stock-levels?item_type=${itemType}`
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [adjustTarget, setAdjustTarget] = useState<StockAdjustTarget | null>(null);

  // Items with no batches yet don't get a stock-levels row at all — treat as zero stock.
  const stockByItemId = Object.fromEntries((stockLevels ?? []).map((s) => [s.item_id, s]));

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setOpen(true);
  }

  function openEdit(item: MaterialItem) {
    setEditing(item);
    setForm({
      name: item.name,
      unit: item.unit,
      current_cost_per_unit: item.current_cost_per_unit,
      reorder_threshold: item.reorder_threshold,
      category: item.category,
      supplier_id: item.supplier_id ?? '',
    });
    setError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const payload = { ...form, supplier_id: form.supplier_id || null };
      if (editing) await api.patch(`${apiPath}/${editing.id}`, payload);
      else await api.post(apiPath, payload);
      setOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setSubmitting(true);
    setError('');
    try {
      await api.delete(`${apiPath}/${editing.id}`);
      setOpen(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Topbar
        title={title}
        subtitle={subtitle}
        action={
          <button className="btn-primary" onClick={openCreate}>
            + New {itemLabel}
          </button>
        }
      />
      <div className="page-content">
        {loading && !items ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : loadError ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {loadError}
          </div>
        ) : (
          <DataTable
            rows={items ?? []}
            keyField="id"
            searchPlaceholder={`Search ${itemLabel}s by name or category…`}
            emptyMessage={`No ${itemLabel}s yet.`}
            onRowClick={openEdit}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'category', header: 'Category', render: (r) => <span className="pill pill-tan">{r.category}</span> },
              { key: 'unit', header: 'Unit' },
              {
                key: 'current_cost_per_unit',
                header: 'Cost / Unit',
                align: 'right',
                render: (r) => formatCurrency(r.current_cost_per_unit),
              },
              { key: 'reorder_threshold', header: 'Reorder Threshold', align: 'right' },
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
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(r);
                      }}
                      title="Edit"
                      aria-label="Edit"
                      style={{ padding: '6px 8px' }}
                    >
                      <Icon name="edit" size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAdjustTarget({ item_type: itemType, item_id: r.id, name: r.name, unit: r.unit });
                      }}
                      style={{ padding: '6px 12px', fontSize: 12.5 }}
                    >
                      Adjust
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>

      <FormModal
        open={open}
        title={editing ? `Edit ${editing.name}` : `New ${itemLabel}`}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      >
        <FormField label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%' }} />
        </FormField>
        <FormField label="Unit">
          <input
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            required
            placeholder="kg, litre, piece…"
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Cost per unit (₹)">
          <input
            type="number"
            min={0}
            step="any"
            value={form.current_cost_per_unit}
            onChange={(e) => setForm({ ...form, current_cost_per_unit: Number(e.target.value) || 0 })}
            required
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Reorder threshold">
          <input
            type="number"
            min={0}
            step="any"
            value={form.reorder_threshold}
            onChange={(e) => setForm({ ...form, reorder_threshold: Number(e.target.value) || 0 })}
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Category">
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Dairy, Dry Goods…"
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Supplier">
          <select value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })} style={{ width: '100%' }}>
            <option value="">None</option>
            {(suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>

        {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{error}</p>}

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            style={{ background: 'none', border: 'none', color: 'var(--color-red-text)', fontSize: 13, padding: 0, marginTop: 4 }}
          >
            Delete {itemLabel}
          </button>
        )}
      </FormModal>

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
