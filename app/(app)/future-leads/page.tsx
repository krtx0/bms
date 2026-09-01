'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import type { Customer, Order } from '@/types';

// Ported from frontend/src/pages/sales/FutureLeadsPage.tsx. No fake WhatsApp/Email send buttons
// — third-party integrations are out of scope, and a non-functional button that looks real would
// be misleading.

// Next occurrence of a recurring (month/day) date, ignoring year — like a birthday.
function nextOccurrence(dateStr: string): Date {
  const d = new Date(dateStr);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = new Date(startOfToday.getFullYear(), d.getMonth(), d.getDate());
  if (next < startOfToday) next.setFullYear(next.getFullYear() + 1);
  return next;
}

interface Occasion {
  key: string;
  customerId: string;
  customerName: string;
  label: string;
  dateStr: string;
  next: Date;
}

export default function FutureLeadsPage() {
  const { data: customers, loading, error, reload: reloadCustomers } = useApiResource<Customer[]>('/api/customers');
  const { data: orders, error: ordersError } = useApiResource<Order[]>('/api/orders');

  if (loading && !customers) {
    return (
      <>
        <Topbar title="Future Leads & CRM" subtitle="Track upcoming occasions and recurring customer moments" />
        <div className="page-content">
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Topbar title="Future Leads & CRM" subtitle="Track upcoming occasions and recurring customer moments" />
        <div className="page-content">
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error}
          </div>
        </div>
      </>
    );
  }

  const occasions: Occasion[] = [];
  for (const c of customers ?? []) {
    for (const d of c.important_dates) {
      occasions.push({ key: `${c.id}-${d.label}-${d.date}`, customerId: c.id, customerName: c.name, label: d.label, dateStr: d.date, next: nextOccurrence(d.date) });
    }
  }
  occasions.sort((a, b) => a.next.getTime() - b.next.getTime());

  // Most recent order per customer (by created_at) — batched once for all customers rather than
  // N+1 fetching per row. Degrades gracefully (shows "—") if /api/orders itself is unavailable.
  const lastOrderByCustomer: Record<string, Order> = {};
  for (const o of orders ?? []) {
    const existing = lastOrderByCustomer[o.customer_id];
    if (!existing || new Date(o.created_at) > new Date(existing.created_at)) lastOrderByCustomer[o.customer_id] = o;
  }

  async function handleRemove(occasion: Occasion) {
    const customer = (customers ?? []).find((c) => c.id === occasion.customerId);
    if (!customer) return;
    const important_dates = customer.important_dates.filter((d) => !(d.label === occasion.label && d.date === occasion.dateStr));
    await api.patch(`/api/customers/${occasion.customerId}`, { important_dates });
    reloadCustomers();
  }

  return (
    <>
      <Topbar title="Future Leads & CRM" subtitle="Track upcoming occasions and recurring customer moments" />
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <DataTable
          rows={occasions}
          keyField="key"
          emptyMessage="No upcoming occasions — add one below."
          columns={[
            { key: 'customerName', header: 'Customer' },
            { key: 'label', header: 'Occasion' },
            { key: 'next', header: 'Next date', render: (r) => r.next.toLocaleDateString() },
            {
              key: 'lastOrder',
              header: 'Last order',
              render: (r) =>
                ordersError ? '—' : lastOrderByCustomer[r.customerId] ? new Date(lastOrderByCustomer[r.customerId].delivery_date).toLocaleDateString() : 'No orders yet',
            },
            {
              key: 'remove',
              header: '',
              render: (r) => (
                <button type="button" className="btn-secondary" onClick={() => handleRemove(r)} style={{ padding: '6px 12px', fontSize: 12.5 }}>
                  Remove
                </button>
              ),
            },
          ]}
        />

        <AddOccasionForm customers={customers ?? []} onAdded={reloadCustomers} />
      </div>
    </>
  );
}

// The one place important_dates gets managed — Customers page intentionally skips it.
function AddOccasionForm({ customers, onAdded }: { customers: Customer[]; onAdded: () => void }) {
  const [customerId, setCustomerId] = useState('');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    setError('');
    if (!customerId || !label.trim() || !date) {
      setError('Fill in customer, label and date.');
      return;
    }
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    setSubmitting(true);
    try {
      const important_dates = [...customer.important_dates, { label: label.trim(), date: new Date(date).toISOString() }];
      await api.patch(`/api/customers/${customerId}`, { important_dates });
      setLabel('');
      setDate('');
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 14 }}>+ Add occasion</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Customer</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} style={{ width: 200 }}>
            <option value="">Select…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Birthday, Anniversary…" style={{ width: 180 }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 160 }} />
        </div>
        <button type="button" className="btn-primary" onClick={handleAdd} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
