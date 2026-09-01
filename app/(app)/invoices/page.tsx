'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { useApiResource } from '@/hooks/useApiResource';
import { formatCurrency } from '@/lib/currency';
import { downloadFile } from '@/lib/download';
import type { Customer, Invoice } from '@/types';

// Ported from frontend/src/pages/sales/InvoicesPage.tsx.

export default function InvoicesPage() {
  const { data: invoices, loading, error } = useApiResource<Invoice[]>('/api/invoices');
  const { data: customers } = useApiResource<Customer[]>('/api/customers');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const customersById = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));
  const customerName = (id: string) => customersById[id]?.name ?? '—';

  async function handleDownload(inv: Invoice) {
    setDownloadingId(inv.id);
    try {
      await downloadFile(`/api/invoices/${inv.id}/pdf`, `${inv.invoice_number}.pdf`);
    } catch {
      alert('Download failed — please try again.');
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <Topbar title="Invoices" subtitle="Generated on full payment" />
      <div className="page-content">
        {loading && !invoices ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : error ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            rows={invoices ?? []}
            keyField="id"
            searchPlaceholder="Search invoices…"
            emptyMessage="No invoices yet — they're generated automatically when an order is fully paid."
            columns={[
              { key: 'invoice_number', header: 'Invoice #' },
              { key: 'issued_date', header: 'Issued', render: (r) => new Date(r.issued_date).toLocaleDateString() },
              { key: 'customer', header: 'Customer', render: (r) => customerName(r.customer_id) },
              { key: 'amount', header: 'Amount', align: 'right', render: (r) => formatCurrency(r.amount) },
              {
                key: 'download',
                header: '',
                align: 'right',
                render: (r) => (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleDownload(r)}
                    disabled={downloadingId === r.id}
                    style={{ padding: '6px 12px', fontSize: 12.5 }}
                  >
                    {downloadingId === r.id ? 'Downloading…' : 'Download PDF'}
                  </button>
                ),
              },
            ]}
          />
        )}
      </div>
    </>
  );
}
