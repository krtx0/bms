'use client';

import { Icon } from './Icon';

export interface LineItem {
  id: string;
  qty_per_unit: number;
}

interface LineItemOption {
  id: string;
  name: string;
}

interface LineItemsEditorProps {
  label: string;
  items: LineItem[];
  options: LineItemOption[];
  onChange: (items: LineItem[]) => void;
}

// Repeatable ingredient/component picker, shared by the recipe form (direct ingredients +
// components used) and the component form (ingredients).
export function LineItemsEditor({ label, items, options, onChange }: LineItemsEditorProps) {
  function update(index: number, patch: Partial<LineItem>) {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }
  function add() {
    onChange([...items, { id: options[0]?.id ?? '', qty_per_unit: 1 }]);
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={item.id} onChange={(e) => update(i, { id: e.target.value })} style={{ flex: 1 }}>
            <option value="" disabled>
              Select…
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step="any"
            value={item.qty_per_unit}
            onChange={(e) => update(i, { qty_per_unit: Number(e.target.value) || 0 })}
            placeholder="Qty"
            style={{ width: 90 }}
          />
          <button type="button" className="btn-secondary" onClick={() => remove(i)} style={{ padding: '8px 12px' }}>
            ×
          </button>
        </div>
      ))}
      {options.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Nothing available to add yet.</p>
      ) : (
        <button
          type="button"
          className="btn-secondary"
          onClick={add}
          style={{ fontSize: 13, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <Icon name="plus" size={13} /> Add row
        </button>
      )}
    </div>
  );
}
