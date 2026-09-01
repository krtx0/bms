'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { FormModal, FormField } from '@/components/FormModal';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import type { Supplier } from '@/types';

interface FormState {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const EMPTY_FORM: FormState = { name: '', contact_person: '', phone: '', email: '', address: '', notes: '' };

export default function SuppliersPage() {
  const { data: suppliers, loading, error, reload } = useApiResource<Supplier[]>('/api/suppliers');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setOpen(true);
  }

  function openEdit(supplier: Supplier) {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contact_person: supplier.contact_person,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes,
    });
    setFormError('');
    setOpen(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setFormError('');
    try {
      if (editing) await api.patch(`/api/suppliers/${editing.id}`, form);
      else await api.post('/api/suppliers', form);
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
      await api.delete(`/api/suppliers/${editing.id}`);
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
        title="Suppliers"
        subtitle="Vendor directory"
        action={
          <button className="btn-primary" onClick={openCreate}>
            + New supplier
          </button>
        }
      />
      <div className="page-content">
        {loading && !suppliers ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : error ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            rows={suppliers ?? []}
            keyField="id"
            searchPlaceholder="Search suppliers by name, phone, email…"
            emptyMessage="No suppliers yet."
            onRowClick={openEdit}
            columns={[
              { key: 'name', header: 'Name' },
              { key: 'contact_person', header: 'Contact Person' },
              { key: 'phone', header: 'Phone' },
              { key: 'email', header: 'Email' },
            ]}
          />
        )}
      </div>

      <FormModal
        open={open}
        title={editing ? `Edit ${editing.name}` : 'New supplier'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        submitting={submitting}
      >
        <FormField label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required style={{ width: '100%' }} />
        </FormField>
        <FormField label="Contact person">
          <input
            value={form.contact_person}
            onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
            style={{ width: '100%' }}
          />
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

        {formError && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{formError}</p>}

        {editing && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            style={{ background: 'none', border: 'none', color: 'var(--color-red-text)', fontSize: 13, padding: 0, marginTop: 4 }}
          >
            Delete supplier
          </button>
        )}
      </FormModal>
    </>
  );
}
