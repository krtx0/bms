'use client';

import { useState } from 'react';
import { Topbar } from '@/components/layout/Topbar';
import { DataTable } from '@/components/DataTable';
import { FormField } from '@/components/FormModal';
import { Icon } from '@/components/Icon';
import { useApiResource } from '@/hooks/useApiResource';
import { api, ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/currency';
import { downloadFile } from '@/lib/download';
import { statusPillClass, paymentPillClass, paymentLabel, priorityPillClass } from '@/lib/orderStatus';
import type { Customer, Invoice, Order, OrderPriority, OrderStatus, Payment, ProductionShortfallItem, Recipe } from '@/types';

// Ported from frontend/src/pages/sales/OrdersPage.tsx.

function todayInputDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TABS: ('All' | OrderStatus)[] = ['All', 'Pending', 'Confirmed', 'Production', 'Ready', 'Delivered'];
const ALL_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Production', 'Ready', 'Delivered', 'Cancelled'];
const ALL_PRIORITIES: OrderPriority[] = ['low', 'medium', 'high'];

export default function OrdersPage() {
  const { data: orders, loading, error, reload } = useApiResource<Order[]>('/api/orders');
  const { data: customers, reload: reloadCustomers } = useApiResource<Customer[]>('/api/customers');
  const { data: recipes } = useApiResource<Recipe[]>('/api/recipes');

  const [mode, setMode] = useState<'list' | 'new' | 'detail'>('list');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatus>('All');

  const customersById = Object.fromEntries((customers ?? []).map((c) => [c.id, c]));
  const customerName = (id: string) => customersById[id]?.name ?? '—';

  function openDetail(id: string) {
    setActiveOrderId(id);
    setMode('detail');
  }

  if (mode === 'new') {
    return (
      <NewOrderForm
        customers={customers ?? []}
        recipes={recipes ?? []}
        onCancel={() => setMode('list')}
        onCreated={(order) => {
          reload();
          reloadCustomers();
          openDetail(order.id);
        }}
      />
    );
  }

  if (mode === 'detail' && activeOrderId) {
    return (
      <OrderDetailView
        orderId={activeOrderId}
        customerName={customerName}
        onBack={() => {
          setMode('list');
          setActiveOrderId(null);
          reload();
        }}
      />
    );
  }

  const allOrders = orders ?? [];
  const counts: Record<string, number> = { All: allOrders.length };
  for (const s of ALL_STATUSES) counts[s] = allOrders.filter((o) => o.status === s).length;
  const filteredOrders = statusFilter === 'All' ? allOrders : allOrders.filter((o) => o.status === statusFilter);

  return (
    <>
      <Topbar
        title="Orders"
        subtitle="Live operational ledger"
        action={
          <button className="btn-primary" onClick={() => setMode('new')}>
            + New order
          </button>
        }
      />
      <div className="page-content">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={statusFilter === t ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setStatusFilter(t)}
              style={{ fontSize: 13, padding: '8px 14px' }}
            >
              {t} ({counts[t] ?? 0})
            </button>
          ))}
        </div>

        {loading && !orders ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        ) : error ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error}
          </div>
        ) : (
          <DataTable
            rows={filteredOrders}
            keyField="id"
            searchPlaceholder="Search by order number…"
            emptyMessage="No orders yet."
            onRowClick={(o) => openDetail(o.id)}
            columns={[
              {
                key: 'order_number',
                header: 'Order #',
                render: (r) => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {r.order_number}
                    {r.source === 'public_form' && (
                      <span className="pill pill-blue" title="Submitted via the public order form">
                        Online
                      </span>
                    )}
                  </span>
                ),
              },
              { key: 'customer', header: 'Customer', render: (r) => customerName(r.customer_id) },
              { key: 'delivery_date', header: 'Delivery', render: (r) => new Date(r.delivery_date).toLocaleDateString() },
              { key: 'flavours', header: 'Flavour(s)', render: (r) => r.line_items.map((l) => l.flavour_code).join(', ') },
              { key: 'selling_price', header: 'Amount', align: 'right', render: (r) => formatCurrency(r.selling_price) },
              { key: 'status', header: 'Status', render: (r) => <span className={`pill ${statusPillClass(r.status)}`}>{r.status}</span> },
              {
                key: 'payment_status',
                header: 'Payment',
                render: (r) => <span className={`pill ${paymentPillClass(r.payment_status)}`}>{paymentLabel(r.payment_status)}</span>,
              },
              {
                key: 'priority',
                header: 'Priority',
                render: (r) => (
                  <span className={`pill ${priorityPillClass(r.priority ?? 'medium')}`}>{(r.priority ?? 'medium').toUpperCase()}</span>
                ),
              },
            ]}
          />
        )}
      </div>
    </>
  );
}

// ------------------------------- New order form -------------------------------

interface OrderLineForm {
  recipe_id: string;
  weight: number;
  quantity: number;
  customizations: string;
  selling_price: number;
}

function NewOrderForm({
  customers,
  recipes,
  onCancel,
  onCreated,
}: {
  customers: Customer[];
  recipes: Recipe[];
  onCancel: () => void;
  onCreated: (order: Order) => void;
}) {
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>('existing');
  const [existingCustomerId, setExistingCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '' });
  const [eventDate, setEventDate] = useState(todayInputDate());
  const [deliveryDate, setDeliveryDate] = useState(todayInputDate());
  const [priority, setPriority] = useState<OrderPriority>('medium');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<OrderLineForm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (lines.length === 0) {
      setError('Add at least one line item.');
      return;
    }
    if (customerMode === 'existing' && !existingCustomerId) {
      setError('Select a customer.');
      return;
    }
    if (customerMode === 'new' && !newCustomer.name.trim()) {
      setError("Enter the new customer's name.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.post<Order>('/api/orders', {
        customer:
          customerMode === 'new'
            ? { name: newCustomer.name, phone: newCustomer.phone || undefined, email: newCustomer.email || undefined }
            : null,
        customer_id: customerMode === 'existing' ? existingCustomerId : null,
        event_date: new Date(eventDate).toISOString(),
        delivery_date: new Date(deliveryDate).toISOString(),
        line_items: lines.map((l) => ({
          recipe_id: l.recipe_id,
          weight: l.weight,
          quantity: l.quantity,
          customizations: l.customizations || undefined,
          selling_price: l.selling_price,
        })),
        notes: notes || undefined,
        priority,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Topbar title="New order" subtitle="Create a multi-line order" />
      <div className="page-content" style={{ maxWidth: 780 }}>
        <button type="button" className="btn-secondary" onClick={onCancel} style={{ marginBottom: 16, fontSize: 13 }}>
          ← Back to orders
        </button>

        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          style={{ padding: 28 }}
        >
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Customer</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <button
              type="button"
              className={customerMode === 'existing' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setCustomerMode('existing')}
            >
              Existing customer
            </button>
            <button
              type="button"
              className={customerMode === 'new' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setCustomerMode('new')}
            >
              New customer
            </button>
          </div>

          {customerMode === 'existing' ? (
            <FormField label="Customer">
              <select value={existingCustomerId} onChange={(e) => setExistingCustomerId(e.target.value)} style={{ width: '100%' }}>
                <option value="">Select…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` — ${c.phone}` : ''}
                  </option>
                ))}
              </select>
            </FormField>
          ) : (
            <>
              <FormField label="Name">
                <input
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Phone">
                <input
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Email">
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  style={{ width: '100%' }}
                />
              </FormField>
            </>
          )}

          <FormField label="Event date">
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required style={{ width: '100%' }} />
          </FormField>
          <FormField label="Delivery date">
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </FormField>
          <FormField label="Priority">
            <select value={priority} onChange={(e) => setPriority(e.target.value as OrderPriority)} style={{ width: '100%' }}>
              {ALL_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          </FormField>

          <h2 style={{ fontSize: 18, margin: '22px 0 14px' }}>Line items</h2>
          <OrderLineItemsEditor lines={lines} recipes={recipes} onChange={setLines} />

          <FormField label="Notes">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
          </FormField>

          {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create order'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// Repeatable recipe + weight + qty + customizations + Rate picker. Rate defaults to the
// recipe's base_cake_price when a recipe is first picked, editable after — never a line total,
// the per-row Amount (rate × qty) is shown alongside for a live invoice-style preview. This is
// pure client-side arithmetic only (Rate × Qty) — server-computed cost/profit fields are never
// previewed here, only the server response after creation carries those.
function OrderLineItemsEditor({
  lines,
  recipes,
  onChange,
}: {
  lines: OrderLineForm[];
  recipes: Recipe[];
  onChange: (lines: OrderLineForm[]) => void;
}) {
  function update(i: number, patch: Partial<OrderLineForm>) {
    onChange(
      lines.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        if (patch.recipe_id !== undefined) {
          const r = recipes.find((rc) => rc.id === patch.recipe_id);
          if (r) next.selling_price = r.base_cake_price;
        }
        return next;
      })
    );
  }
  function remove(i: number) {
    onChange(lines.filter((_, idx) => idx !== i));
  }
  function add() {
    const r = recipes[0];
    onChange([...lines, { recipe_id: r?.id ?? '', weight: 1, quantity: 1, customizations: '', selling_price: r?.base_cake_price ?? 0 }]);
  }

  const total = lines.reduce((sum, l) => sum + l.selling_price * l.quantity, 0);

  return (
    // overflowX: auto — the row below is a fixed-width flex layout (weight/qty/rate columns
    // don't wrap), so it overflows horizontally at mobile widths without this.
    <div style={{ marginBottom: 16, overflowX: 'auto' }}>
      {lines.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--color-text-secondary)',
            marginBottom: 6,
            fontWeight: 600,
          }}
        >
          <span style={{ flex: '2 1 0' }}>Flavour</span>
          <span style={{ width: 70 }}>Weight</span>
          <span style={{ width: 60 }}>Qty</span>
          <span style={{ flex: '1.4 1 0' }}>Customizations</span>
          <span style={{ width: 90 }}>Rate</span>
          <span style={{ width: 90, textAlign: 'right' }}>Amount</span>
          <span style={{ width: 28 }} />
        </div>
      )}
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <select value={line.recipe_id} onChange={(e) => update(i, { recipe_id: e.target.value })} style={{ flex: '2 1 0', minWidth: 0 }}>
            <option value="" disabled>
              Select…
            </option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.flavour_code} — {r.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step="any"
            value={line.weight}
            onChange={(e) => update(i, { weight: Number(e.target.value) || 0 })}
            placeholder="kg"
            style={{ width: 70 }}
          />
          <input
            type="number"
            min={1}
            step="any"
            value={line.quantity}
            onChange={(e) => update(i, { quantity: Number(e.target.value) || 0 })}
            style={{ width: 60 }}
          />
          <input
            value={line.customizations}
            onChange={(e) => update(i, { customizations: e.target.value })}
            placeholder="Optional"
            style={{ flex: '1.4 1 0', minWidth: 0 }}
          />
          <input
            type="number"
            min={0}
            step="any"
            value={line.selling_price}
            onChange={(e) => update(i, { selling_price: Number(e.target.value) || 0 })}
            style={{ width: 90 }}
          />
          <span style={{ width: 90, textAlign: 'right', fontSize: 13.5 }}>{formatCurrency(line.selling_price * line.quantity)}</span>
          <button type="button" className="btn-secondary" onClick={() => remove(i)} style={{ padding: '8px 10px' }}>
            ×
          </button>
        </div>
      ))}
      {recipes.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)' }}>Add a recipe first.</p>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={add}
            style={{ fontSize: 13, padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <Icon name="plus" size={13} /> Add line
          </button>
          <span style={{ fontSize: 14 }}>
            Order total: <strong>{formatCurrency(total)}</strong>
          </span>
        </div>
      )}
    </div>
  );
}

// -------------------------------- Order detail --------------------------------

function OrderDetailView({
  orderId,
  customerName,
  onBack,
}: {
  orderId: string;
  customerName: (id: string) => string;
  onBack: () => void;
}) {
  const { data: order, loading, error, reload } = useApiResource<Order>(`/api/orders/${orderId}`);
  const { data: payments, reload: reloadPayments } = useApiResource<Payment[]>(`/api/orders/${orderId}/payments`);
  const { data: invoices, reload: reloadInvoices } = useApiResource<Invoice[]>(`/api/invoices?order_id=${orderId}`);

  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [shortfallWarning, setShortfallWarning] = useState<ProductionShortfallItem[] | null>(null);

  const [prioritySubmitting, setPrioritySubmitting] = useState(false);
  const [priorityError, setPriorityError] = useState('');

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  async function handleStatusChange(newStatus: string) {
    setStatusSubmitting(true);
    setStatusError('');
    setShortfallWarning(null);
    try {
      // shortfall is `{}` for any non-Production transition, and only ever carries a
      // `shortfalls` key (possibly an empty array) the first time an order reaches Production.
      const res = await api.patch<{ order: Order; shortfall: { shortfalls?: ProductionShortfallItem[] } }>(
        `/api/orders/${orderId}/status`,
        { status: newStatus }
      );
      reload();
      const shortfalls = res.shortfall?.shortfalls ?? [];
      if (shortfalls.length > 0) setShortfallWarning(shortfalls);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    setPrioritySubmitting(true);
    setPriorityError('');
    try {
      await api.patch(`/api/orders/${orderId}`, { priority: newPriority });
      reload();
    } catch (err) {
      setPriorityError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPrioritySubmitting(false);
    }
  }

  async function handlePayment() {
    if (paymentAmount <= 0) {
      setPaymentError('Enter an amount greater than zero.');
      return;
    }
    setPaymentSubmitting(true);
    setPaymentError('');
    try {
      await api.post(`/api/orders/${orderId}/payments`, {
        amount: paymentAmount,
        method: paymentMethod || undefined,
        notes: paymentNotes || undefined,
      });
      setPaymentAmount(0);
      setPaymentMethod('');
      setPaymentNotes('');
      reload();
      reloadPayments();
      reloadInvoices();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setPaymentSubmitting(false);
    }
  }

  async function handleDownloadInvoice(inv: Invoice) {
    setDownloadingInvoiceId(inv.id);
    try {
      await downloadFile(`/api/invoices/${inv.id}/pdf`, `${inv.invoice_number}.pdf`);
    } catch {
      alert('Download failed — please try again.');
    } finally {
      setDownloadingInvoiceId(null);
    }
  }

  const backButton = (
    <button type="button" className="btn-secondary" onClick={onBack} style={{ marginBottom: 16, fontSize: 13 }}>
      ← Back to orders
    </button>
  );

  if (loading && !order) {
    return (
      <>
        <Topbar title="Order" />
        <div className="page-content">
          {backButton}
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            Loading…
          </div>
        </div>
      </>
    );
  }

  if (error || !order) {
    return (
      <>
        <Topbar title="Order" />
        <div className="page-content">
          {backButton}
          <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--color-red-text)' }}>
            {error ?? 'Order not found.'}
          </div>
        </div>
      </>
    );
  }

  const outstanding = order.selling_price - order.amount_paid;

  return (
    <>
      <Topbar title={order.order_number} subtitle={customerName(order.customer_id)} />
      <div className="page-content" style={{ maxWidth: 820 }}>
        {backButton}

        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Event date
              </div>
              <div>{new Date(order.event_date).toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Delivery date
              </div>
              <div>{new Date(order.delivery_date).toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Status
              </div>
              <select value={order.status} disabled={statusSubmitting} onChange={(e) => handleStatusChange(e.target.value)}>
                {ALL_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Payment
              </div>
              <span className={`pill ${paymentPillClass(order.payment_status)}`}>{paymentLabel(order.payment_status)}</span>
            </div>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                Priority
              </div>
              <select
                value={order.priority ?? 'medium'}
                disabled={prioritySubmitting}
                onChange={(e) => handlePriorityChange(e.target.value)}
              >
                {ALL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {statusError && (
            <p style={{ color: 'var(--color-red-text)', fontSize: 13, marginTop: 12 }}>{statusError}</p>
          )}
          {priorityError && (
            <p style={{ color: 'var(--color-red-text)', fontSize: 13, marginTop: 12 }}>{priorityError}</p>
          )}
          {shortfallWarning && (
            <div
              className="card"
              style={{ padding: 12, marginTop: 14, background: 'var(--color-red-bg)', color: 'var(--color-red-text)', fontSize: 13 }}
            >
              Production started, but stock ran short — check Inventory.
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {shortfallWarning.map((s) => (
                  <li key={s.ingredient_id}>
                    {s.name}: short by {s.shortfall_qty} {s.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {order.notes && <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 14 }}>{order.notes}</p>}
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Line items</h3>
          <table style={{ width: '100%', fontSize: 13.5, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: 'var(--color-text-secondary)' }}>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Flavour</th>
                <th style={{ textAlign: 'left', padding: '4px 0' }}>Weight</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Rate</th>
                <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.line_items.map((li, i) => (
                <tr key={i}>
                  <td style={{ padding: '6px 0' }}>
                    {li.flavour_code}
                    {li.customizations ? ` — ${li.customizations}` : ''}
                  </td>
                  <td>{li.weight}</td>
                  <td style={{ textAlign: 'right' }}>{li.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(li.selling_price)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(li.line_total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14, fontSize: 14 }}>
            <span>
              Order total: <strong>{formatCurrency(order.selling_price)}</strong>
            </span>
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Payment</h3>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13.5 }}>
            <span>
              Total: <strong>{formatCurrency(order.selling_price)}</strong>
            </span>
            <span>
              Paid: <strong>{formatCurrency(order.amount_paid)}</strong>
            </span>
            <span>
              Outstanding: <strong>{formatCurrency(outstanding)}</strong>
            </span>
          </div>

          {payments && payments.length > 0 && (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr style={{ color: 'var(--color-text-secondary)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '4px 0' }}>Method</th>
                  <th style={{ textAlign: 'right', padding: '4px 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td style={{ padding: '4px 0' }}>{new Date(p.payment_date).toLocaleDateString()}</td>
                    <td>{p.method || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {outstanding > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Amount</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)}
                  style={{ width: 120 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Method</label>
                <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="cash, card…" style={{ width: 120 }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>Notes</label>
                <input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} style={{ width: '100%' }} />
              </div>
              <button type="button" className="btn-primary" onClick={handlePayment} disabled={paymentSubmitting}>
                {paymentSubmitting ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          )}
          {paymentError && <p style={{ color: 'var(--color-red-text)', fontSize: 13, marginTop: 8 }}>{paymentError}</p>}
        </div>

        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Status history</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
            {order.status_history.map((h, i) => (
              <li key={i}>
                {h.status} — {new Date(h.changed_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>

        {invoices && invoices.length > 0 && (
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>Invoice</h3>
            {invoices.map((inv) => (
              <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13.5 }}>
                  {inv.invoice_number} — {formatCurrency(inv.amount)}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleDownloadInvoice(inv)}
                  disabled={downloadingInvoiceId === inv.id}
                  style={{ padding: '6px 14px', fontSize: 13 }}
                >
                  {downloadingInvoiceId === inv.id ? 'Downloading…' : 'Download invoice'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
