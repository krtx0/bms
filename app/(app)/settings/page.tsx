'use client';

import { useEffect, useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { FormField } from '@/components/FormModal';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import type { BusinessInfo, Settings, Workspace } from '@/types';

// Ported from frontend/src/pages/settings/SettingsPage.tsx.

type Tab = 'brand' | 'team';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('brand');

  return (
    <>
      <Topbar title="Settings" subtitle="Workspace, brand and team preferences" />
      <div className="page-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button className={tab === 'brand' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('brand')}>
            Brand
          </button>
          <button className={tab === 'team' ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab('team')}>
            Team & Roles
          </button>
        </div>

        {tab === 'brand' ? <BrandTab /> : <TeamTab />}
      </div>
    </>
  );
}

// ---------------------------------- Brand tab ----------------------------------

const EMPTY_BUSINESS: BusinessInfo = { name: '', tagline: '', email: '', phone: '', address: '', gstin: '' };
const EMPTY_WORKSPACE: Workspace = { currency: '', timezone: '' };

function BrandTab() {
  const { data, loading, error } = useApiResource<Settings>('/api/settings');
  const [business, setBusiness] = useState<BusinessInfo>(EMPTY_BUSINESS);
  const [workspace, setWorkspace] = useState<Workspace>(EMPTY_WORKSPACE);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  // Fetched settings arrive after mount — seed the editable form once they do.
  useEffect(() => {
    if (data) {
      setBusiness(data.business_info);
      setWorkspace(data.workspace);
    }
  }, [data]);

  async function handleSave() {
    setSubmitting(true);
    setSaveError('');
    setSaved(false);
    try {
      const updated = await api.put<Settings>('/api/settings', { business_info: business, workspace });
      setBusiness(updated.business_info);
      setWorkspace(updated.workspace);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Loading…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
        {error}
      </div>
    );
  }

  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      style={{ padding: 28, maxWidth: 560 }}
    >
      <h2 style={{ fontSize: 18, marginBottom: 18 }}>Business info</h2>

      <FormField label="Business name">
        <input
          value={business.name}
          onChange={(e) => {
            setBusiness({ ...business, name: e.target.value });
            setSaved(false);
          }}
          style={{ width: '100%' }}
        />
      </FormField>
      <FormField label="Tagline">
        <input
          value={business.tagline}
          onChange={(e) => {
            setBusiness({ ...business, tagline: e.target.value });
            setSaved(false);
          }}
          style={{ width: '100%' }}
        />
      </FormField>
      <FormField label="Email">
        <input
          type="email"
          value={business.email}
          onChange={(e) => {
            setBusiness({ ...business, email: e.target.value });
            setSaved(false);
          }}
          style={{ width: '100%' }}
        />
      </FormField>
      <FormField label="Phone">
        <input
          value={business.phone}
          onChange={(e) => {
            setBusiness({ ...business, phone: e.target.value });
            setSaved(false);
          }}
          style={{ width: '100%' }}
        />
      </FormField>
      <FormField label="Address">
        <textarea
          value={business.address}
          onChange={(e) => {
            setBusiness({ ...business, address: e.target.value });
            setSaved(false);
          }}
          rows={2}
          style={{ width: '100%', resize: 'vertical' }}
        />
      </FormField>
      <FormField label="GSTIN">
        <input
          value={business.gstin}
          onChange={(e) => {
            setBusiness({ ...business, gstin: e.target.value });
            setSaved(false);
          }}
          style={{ width: '100%' }}
        />
      </FormField>

      <h2 style={{ fontSize: 18, margin: '22px 0 18px' }}>Workspace</h2>

      {/* Single-currency app — plain text, not a currency picker. */}
      <FormField label="Currency">
        <input
          value={workspace.currency}
          onChange={(e) => {
            setWorkspace({ ...workspace, currency: e.target.value });
            setSaved(false);
          }}
          style={{ width: '100%' }}
        />
      </FormField>
      <FormField label="Timezone">
        <input
          value={workspace.timezone}
          onChange={(e) => {
            setWorkspace({ ...workspace, timezone: e.target.value });
            setSaved(false);
          }}
          style={{ width: '100%' }}
        />
      </FormField>

      {saveError && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{saveError}</p>}
      {saved && !saveError && <p style={{ color: 'var(--color-green-text)', fontSize: 13 }}>Saved.</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

// ------------------------------- Team & Roles tab -------------------------------
// Genuinely non-functional — matches the client spec's own "Team & Roles (Future Ready)"
// framing. No Notifications/Integrations/Billing tabs either: unrequested scaffolding for
// features not being built.

function TeamTab() {
  return (
    <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
      Team & Roles (Future Ready) — coming soon.
    </div>
  );
}
