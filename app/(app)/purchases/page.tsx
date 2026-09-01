'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { FormModal, FormField } from '@/components/FormModal';
import { Icon } from '@/components/Icon';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/currency';
import type { MaterialItem, Purchase, PurchaseLineItem, Supplier } from '@/types';

// Ported from frontend/src/pages/production/PurchasesPage.tsx.

function todayInputDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface PurchaseFormState {
  supplier_id: string;
  purchase_date: string;
  notes: string;
  line_items: PurchaseLineItem[];
}

const EMPTY_PURCHASE_FORM: PurchaseFormState = {
  supplier_id: '',
  purchase_date: todayInputDate(),
  notes: '',
  line_items: [],
};

export default function PurchasesPage() {
  const { data: purchases, loading, error: loadError, reload } = useApiResource<Purchase[]>('/api/purchases');
  const { data: suppliers } = useApiResource<Supplier[]>('/api/suppliers');
  const { data: ingredients } = useApiResource<MaterialItem[]>('/api/ingredients');
  const { data: packaging } = useApiResource<MaterialItem[]>('/api/packaging');

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PurchaseFormState>(EMPTY_PURCHASE_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<Purchase | null>(null);

  const suppliersById = Object.fromEntries((suppliers ?? []).map((s) => [s.id, s]));
  const supplierName = (id: string | null) => (id && suppliersById[id] ? suppliersById[id].name : '—');

  const itemsByKey = Object.fromEntries([
    ...(ingredients ?? []).map((i) => [`ingredient:${i.id}`, i] as const),
    ...(packaging ?? []).map((p) => [`packaging:${p.id}`, p] as const),
  ]);
  const itemName = (line: PurchaseLineItem) => itemsByKey[`${line.item_type}:${line.item_id}`]?.name ?? line.item_id;

  function openCreate() {
    setForm(EMPTY_PURCHASE_FORM);
    setError('');
    setOpen(true);
  }

  async function handleSubmit() {
    if (form.line_items.length === 0) {
      setError('Add at least one line item.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/purchases', {
        supplier_id: form.supplier_id || null,
        purchase_date: new Date(form.purchase_date).toISOString(),
        notes: form.notes,
        line_items: form.line_items,
      });
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
        title="Purchases"
        subtitle="Supplier purchase entries"
        action={
          <button className="btn-primary" onClick={openCreate}>
            + New purchase
          </button>
        }
      />
      <div className="page-content">
        {loading && !purchases ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : loadError ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {loadError}
          </div>
        ) : (
          <DataTable
            rows={purchases ?? []}
            keyField="id"
            searchPlaceholder="Search purchases…"
            emptyMessage="No purchases yet."
            onRowClick={(p) => setViewing(p)}
            columns={[
              { key: 'purchase_number', header: 'Purchase #' },
              { key: 'purchase_date', header: 'Date', render: (r) => new Date(r.purchase_date).toLocaleDateString() },
              { key: 'supplier', header: 'Supplier', render: (r) => supplierName(r.supplier_id) },
              { key: 'total_cost', header: 'Total', align: 'right', render: (r) => formatCurrency(r.total_cost) },
              { key: 'line_items', header: 'Line Items', align: 'right', render: (r) => String(r.line_items.length) },
            ]}
          />
        )}
      </div>

      <FormModal
        open={open}
        title="New purchase"
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="Create purchase"
      >
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
        <FormField label="Purchase date">
          <input
            type="date"
            value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            required
            style={{ width: '100%' }}
          />
        </FormField>

        <PurchaseLineItemsEditor
          lines={form.line_items}
          ingredients={ingredients ?? []}
          packaging={packaging ?? []}
          onChange={(line_items) => setForm({ ...form, line_items })}
        />

        <FormField label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </FormField>

        {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{error}</p>}
      </FormModal>

      <PurchaseDetailModal
        purchase={viewing}
        supplierName={viewing ? supplierName(viewing.supplier_id) : ''}
        itemName={itemName}
        onClose={() => setViewing(null)}
      />
    </>
  );
}

// ---- New-purchase line items: item type + item + qty + unit cost per row. ----
// Doesn't fit LineItemsEditor's {id, qty_per_unit} shape, so it gets its own small editor
// rather than contorting that shared component to cover both.
function PurchaseLineItemsEditor({
  lines,
  ingredients,
  packaging,
  onChange,
}: {
  lines: PurchaseLineItem[];
  ingredients: MaterialItem[];
  packaging: MaterialItem[];
  onChange: (lines: PurchaseLineItem[]) => void;
}) {
  function optionsFor(itemType: 'ingredient' | 'packaging') {
    return itemType === 'ingredient' ? ingredients : packaging;
  }
  function update(index: number, patch: Partial<PurchaseLineItem>) {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function remove(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }
  function add() {
    const item_type: 'ingredient' | 'packaging' = ingredients[0] ? 'ingredient' : 'packaging';
    const first = optionsFor(item_type)[0];
    onChange([...lines, { item_type, item_id: first?.id ?? '', quantity: 1, unit_cost: first?.current_cost_per_unit ?? 0 }]);
  }

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unit_cost, 0);
  const nothingAvailable = ingredients.length === 0 && packaging.length === 0;

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Line items</label>
      <div style={{ overflowX: 'auto' }}>
      {lines.map((line, i) => {
        const options = optionsFor(line.item_type);
        return (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, minWidth: 560 }}>
            <select
              value={line.item_type}
              onChange={(e) => {
                const item_type = e.target.value as 'ingredient' | 'packaging';
                const firstOption = optionsFor(item_type)[0];
                update(i, { item_type, item_id: firstOption?.id ?? '', unit_cost: firstOption?.current_cost_per_unit ?? 0 });
              }}
              style={{ width: 105 }}
            >
              <option value="ingredient">Ingredient</option>
              <option value="packaging">Packaging</option>
            </select>
            <select
              value={line.item_id}
              onChange={(e) => {
                const item_id = e.target.value;
                const selected = options.find((o) => o.id === item_id);
                update(i, { item_id, unit_cost: selected?.current_cost_per_unit ?? line.unit_cost });
              }}
              style={{ flex: 1, minWidth: 0 }}
            >
              <option value="" disabled>
                Select…
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.unit})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="any"
              value={line.quantity}
              onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
              placeholder="Qty"
              style={{ width: 70 }}
            />
            <input
              type="number"
              min={0}
              step="any"
              value={line.unit_cost}
              onChange={(e) => update(i, { unit_cost: Number(e.target.value) || 0 })}
              placeholder="Unit ₹"
              style={{ width: 90 }}
            />
            <button type="button" className="btn-secondary" onClick={() => remove(i)} style={{ padding: '8px 12px' }}>
              ×
            </button>
          </div>
        );
      })}
      </div>
      {nothingAvailable ? (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Add an ingredient or packaging item first.</p>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={add}
            style={{ fontSize: 13, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Icon name="plus" size={13} /> Add line
          </button>
          <span style={{ fontSize: 13 }}>
            Total: <strong>{formatCurrency(total)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// ---- Read-only purchase detail — no edit endpoint exists on the backend, ----
// so this is a plain close-only view, not a FormModal with Cancel/Save.
function PurchaseDetailModal({
  purchase,
  supplierName,
  itemName,
  onClose,
}: {
  purchase: Purchase | null;
  supplierName: string;
  itemName: (line: PurchaseLineItem) => string;
  onClose: () => void;
}) {
  if (!purchase) return null;
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 480, maxWidth: '100%', maxHeight: '86vh', overflowY: 'auto', background: '#fff', padding: 28 }}
      >
        <h2 style={{ fontSize: 19, marginBottom: 4 }}>{purchase.purchase_number}</h2>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 18 }}>
          {new Date(purchase.purchase_date).toLocaleDateString()} · {supplierName}
        </p>

        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 16 }}>
          <thead>
            <tr style={{ color: 'var(--color-text-secondary)' }}>
              <th style={{ textAlign: 'left', padding: '4px 0' }}>Item</th>
              <th style={{ textAlign: 'left', padding: '4px 0' }}>Type</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Unit cost</th>
              <th style={{ textAlign: 'right', padding: '4px 0' }}>Line cost</th>
            </tr>
          </thead>
          <tbody>
            {purchase.line_items.map((li, i) => (
              <tr key={i}>
                <td style={{ padding: '3px 0' }}>{itemName(li)}</td>
                <td style={{ padding: '3px 0' }}>
                  <span className="pill pill-tan">{li.item_type}</span>
                </td>
                <td style={{ textAlign: 'right' }}>{li.quantity}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(li.unit_cost)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(li.quantity * li.unit_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600 }}>
          <span>Total</span>
          <span>{formatCurrency(purchase.total_cost)}</span>
        </div>

        {purchase.notes && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 12 }}>{purchase.notes}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
