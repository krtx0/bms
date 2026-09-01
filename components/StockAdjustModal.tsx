'use client';

import { useState } from 'react';
import { FormModal, FormField } from './FormModal';
import { api, ApiError } from '@/lib/apiClient';
import type { ItemType } from '@/types';

export interface StockAdjustTarget {
  item_type: ItemType;
  item_id: string;
  name: string;
  unit: string;
}

// Shared manual stock-adjustment modal — used by MaterialPage (ingredients/packaging) and the
// Semi-Finished page. Posts a signed quantity_delta to /api/inventory/adjustments (positive adds
// stock, negative removes it, FIFO on the backend). Ported from
// frontend/src/components/StockAdjustModal.tsx.
export function StockAdjustModal({
  target,
  onClose,
  onAdjusted,
}: {
  target: StockAdjustTarget | null;
  onClose: () => void;
  onAdjusted: () => void;
}) {
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!target) return null;
  const { item_type, item_id, name, unit } = target;

  function handleClose() {
    setDelta(0);
    setReason('');
    setError('');
    onClose();
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await api.post('/api/inventory/adjustments', { item_type, item_id, quantity_delta: delta, reason: reason || undefined });
      onAdjusted();
      handleClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FormModal open title={`Adjust stock — ${name}`} onClose={handleClose} onSubmit={handleSubmit} submitting={submitting} submitLabel="Apply">
      <FormField label={`Quantity change (${unit}) — negative to remove`}>
        <input
          type="number"
          step="any"
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value) || 0)}
          required
          autoFocus
          style={{ width: '100%' }}
        />
      </FormField>
      <FormField label="Reason (optional)">
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Stock take, wastage…" style={{ width: '100%' }} />
      </FormField>
      {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{error}</p>}
    </FormModal>
  );
}
