'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { FormModal, FormField } from '@/components/FormModal';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/currency';
import { statusPillClass, paymentPillClass } from '@/lib/orderStatus';
import type { Customer, Order } from '@/types';

// Ported from frontend/src/pages/sales/CustomersPage.tsx.

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_lead: boolean;
}

const EMPTY_FORM: FormState = { name: '', phone: '', email: '', address: '', notes: '', is_lead: false };

export default function CustomersPage() {
  const { data: customers, loading, error, reload } = useApiResource<Customer[]>('/api/customers');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [viewing, setViewing] = useState<Customer | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setOpen(true);
  }

  function openEdit(customer: Customer) {
    setEditing(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
      is_lead: customer.is_lead,
    });
    setFormError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setFormError('');
    try {
      if (editing) await api.patch(`/api/customers/${editing.id}`, form);
      else await api.post('/api/customers', form);
      setOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setSubmitting(true);
    setFormError('');
    try {
      await api.delete(`/api/customers/${editing.id}`);
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
      <Topbar
        title="Customer Form"
        subtitle="Customer profiles and history"
        action={
          <button className="btn-primary" onClick={openCreate}>
            + New customer
          </button>
        }
      />
      <div className="page-content">
        {loading && !customers ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : error ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            rows={customers ?? []}
            keyField="id"
            searchPlaceholder="Search customers by name, phone, email…"
            emptyMessage="No customers yet."
            onRowClick={(c) => setViewing(c)}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'phone', header: 'Phone' },
              { key: 'email', header: 'Email' },
              { key: 'is_lead', header: '', render: (r) => (r.is_lead ? <span className="pill pill-tan">Lead</span> : null) },
            ]}
          />
        )}
      </div>

      <FormModal
        open={open}
        title={editing ? `Edit ${editing.name}` : 'New customer'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      >
        <FormField label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%' }} />
        </FormField>
        <FormField label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={{ width: '100%' }} />
        </FormField>
        <FormField label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            style={{ width: '100%' }}
          />
        </FormField>
        <FormField label="Address">
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <input
            id="is_lead"
            type="checkbox"
            checked={form.is_lead}
            onChange={(e) => setForm({ ...form, is_lead: e.target.checked })}
          />
          <label htmlFor="is_lead" style={{ fontSize: 13.5 }}>
            Mark as lead (not yet a paying customer)
          </label>
        </div>

        {formError && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{formError}</p>}

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            style={{ background: 'none', border: 'none', color: 'var(--color-red-text)', fontSize: 13, padding: 0, marginTop: 4 }}
          >
            Delete customer
          </button>
        )}
      </FormModal>

      {viewing && (
        <CustomerDetailModal
          customer={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            openEdit(viewing);
            setViewing(null);
          }}
        />
      )}
    </>
  );
}

// ---- Detail view: customer fields + order history (GET /api/orders?customer_id=), per spec. ----
function CustomerDetailModal({ customer, onClose, onEdit }: { customer: Customer; onClose: () => void; onEdit: () => void }) {
  const { data: orders, loading, error } = useApiResource<Order[]>(`/api/orders?customer_id=${customer.id}`);

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
        style={{ width: 560, maxWidth: '100%', maxHeight: '86vh', overflowY: 'auto', background: '#fff', padding: 28 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 19, marginBottom: 4 }}>{customer.name}</h2>
            {customer.is_lead && <span className="pill pill-tan">Lead</span>}
          </div>
          <button type="button" className="btn-secondary" onClick={onEdit} style={{ padding: '6px 14px', fontSize: 13 }}>
            Edit
          </button>
        </div>

        <div style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 12, lineHeight: 1.8 }}>
          {customer.phone && <div>Phone: {customer.phone}</div>}
          {customer.email && <div>Email: {customer.email}</div>}
          {customer.address && <div>Address: {customer.address}</div>}
          {customer.notes && <div>Notes: {customer.notes}</div>}
        </div>

        <h3 style={{ fontSize: 14, marginTop: 22, marginBottom: 10 }}>Order history</h3>
        {loading ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Loading…</p>
        ) : error ? (
          <p style={{ fontSize: 13, color: 'var(--color-red-text)' }}>{error}</p>
        ) : !orders || orders.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>No orders yet.</p>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Order #</th>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Payment</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Delivery</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ padding: '5px 0' }}>{o.order_number}</td>
                  <td style={{ padding: '5px 0' }}>
                    <span className={`pill ${statusPillClass(o.status)}`}>{o.status}</span>
                  </td>
                  <td style={{ padding: '5px 0' }}>
                    <span className={`pill ${paymentPillClass(o.payment_status)}`}>{o.payment_status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(o.selling_price)}</td>
                  <td style={{ textAlign: 'right' }}>{new Date(o.delivery_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
