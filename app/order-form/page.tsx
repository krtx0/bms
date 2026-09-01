'use client';

import { useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/FormModal';

// Public, unauthenticated intake form — see web/proxy.ts for the route exception and
// web/app/api/public/orders/route.ts for the validation/rate-limiting this posts to. No "Save
// draft" button: the video reference shows one, but there's no draft-storage backend for it, and
// this codebase has an explicit precedent (Future Leads) against shipping buttons that look real
// but don't do anything.

interface RecipeOption {
  id: string;
  name: string;
  flavour_code: string;
}

const EVENT_TYPES = ['Birthday', 'Anniversary', 'Wedding', 'Corporate', 'Other'] as const;
const WEIGHT_PRESETS = [0.5, 1, 1.5, 2, 3];
const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening'] as const;
const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank Transfer'] as const;

interface FormState {
  full_name: string;
  whatsapp_number: string;
  email: string;
  address: string;
  event_type: (typeof EVENT_TYPES)[number];
  event_date: string;
  product_category: string;
  recipe_id: string;
  egg_type: 'Egg' | 'Eggless';
  weight_kg: number;
  quantity: number;
  fulfillment: 'Pickup' | 'Delivery';
  time_slot: (typeof TIME_SLOTS)[number];
  payment_method: (typeof PAYMENT_METHODS)[number];
  advance_amount: number;
  additional_notes: string;
  partner_birthday: string;
  anniversary: string;
  childrens_birthdays: string;
  other_family_occasions: string;
  recurring_events: string;
  special_reminders: string;
  website: string; // honeypot — real visitors never see or fill this
}

const EMPTY_FORM: FormState = {
  full_name: '',
  whatsapp_number: '',
  email: '',
  address: '',
  event_type: 'Birthday',
  event_date: '',
  product_category: '',
  recipe_id: '',
  egg_type: 'Egg',
  weight_kg: 1,
  quantity: 1,
  fulfillment: 'Delivery',
  time_slot: 'Morning',
  payment_method: 'UPI',
  advance_amount: 0,
  additional_notes: '',
  partner_birthday: '',
  anniversary: '',
  childrens_birthdays: '',
  other_family_occasions: '',
  recurring_events: '',
  special_reminders: '',
  website: '',
};

const STEPS = ['About you', 'The cake', 'Customisation & delivery', 'Family & occasions'];

export default function OrderFormPage() {
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [customWeight, setCustomWeight] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedOrderNumber, setSubmittedOrderNumber] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const stepRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  useEffect(() => {
    fetch('/api/public/recipes')
      .then((r) => r.json())
      .then((data) => {
        setRecipes(data);
        if (data[0]) setForm((f) => ({ ...f, recipe_id: data[0].id }));
      })
      .catch(() => setRecipes([]));
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = stepRefs.findIndex((r) => r.current === entry.target);
          if (idx !== -1) setActiveStep(idx);
        }
      },
      { rootMargin: '-15% 0px -70% 0px' }
    );
    stepRefs.forEach((r) => r.current && observer.observe(r.current));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    setError('');
    if (!form.full_name.trim() || !form.whatsapp_number.trim() || !form.email.trim()) {
      setError('Fill in your name, WhatsApp number and email.');
      return;
    }
    if (!form.event_date) {
      setError('Pick an event date.');
      return;
    }
    if (!form.recipe_id) {
      setError('Select a flavour.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, event_date: new Date(form.event_date).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || 'Something went wrong. Please try again.');
        return;
      }
      setSubmittedOrderNumber(data.order_number);
    } catch {
      setError('Something went wrong. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedOrderNumber) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-page)',
          padding: 20,
        }}
      >
        <div className="card" style={{ padding: 40, maxWidth: 440, textAlign: 'center', background: '#fff' }}>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>Thank you!</h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            Your request has been received as <strong>{submittedOrderNumber}</strong>. We&apos;ll reach out on WhatsApp
            or email to confirm the details and pricing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-page)' }}>
      <div className="order-form-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ padding: '48px 32px' }}>
          <div style={{ position: 'sticky', top: 48 }}>
            <h1 style={{ fontSize: 28, lineHeight: 1.25 }}>
              Let&apos;s bake something <span style={{ color: 'var(--color-accent-gold)' }}>unforgettable.</span>
            </h1>
            <p style={{ fontSize: 13.5, color: 'var(--color-text-secondary)', marginTop: 12, lineHeight: 1.6 }}>
              Share a few details about your event and we&apos;ll craft a cake worthy of the moment.
            </p>

            <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {STEPS.map((label, i) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: i === activeStep ? 1 : 0.5 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: i === activeStep ? 'var(--color-sidebar-bg)' : 'transparent',
                      color: i === activeStep ? '#fff' : 'var(--color-text-secondary)',
                      border: i === activeStep ? 'none' : '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: i === activeStep ? 600 : 400 }}>{label}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 14, marginTop: 28, background: 'var(--color-tan-bg)', border: 'none' }}>
              <p style={{ fontSize: 12.5, color: 'var(--color-tan-text)', lineHeight: 1.5 }}>
                Every order helps us remember your special moments — for next time.
              </p>
            </div>
          </div>
        </div>

        <div style={{ padding: '48px 32px 100px' }}>
          {/* Honeypot — off-screen, not display:none/type=hidden (some bots skip those specifically). */}
          <input
            type="text"
            name="website"
            value={form.website}
            onChange={(e) => update('website', e.target.value)}
            style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
          />

          <div ref={stepRefs[0]} className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>About you</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormField label="Full name *">
                <input value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required style={{ width: '100%' }} />
              </FormField>
              <FormField label="WhatsApp number *">
                <input
                  value={form.whatsapp_number}
                  onChange={(e) => update('whatsapp_number', e.target.value)}
                  placeholder="+91"
                  required
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Email *">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Address (for delivery)">
                <input value={form.address} onChange={(e) => update('address', e.target.value)} style={{ width: '100%' }} />
              </FormField>
            </div>
          </div>

          <div ref={stepRefs[1]} className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>The cake</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormField label="Event type *">
                <select value={form.event_type} onChange={(e) => update('event_type', e.target.value as FormState['event_type'])} style={{ width: '100%' }}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Event date *">
                <input type="date" value={form.event_date} onChange={(e) => update('event_date', e.target.value)} required style={{ width: '100%' }} />
              </FormField>
              <FormField label="Product category">
                <input
                  value={form.product_category}
                  onChange={(e) => update('product_category', e.target.value)}
                  placeholder="Celebration cake, Cupcakes…"
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Flavour *">
                <select value={form.recipe_id} onChange={(e) => update('recipe_id', e.target.value)} required style={{ width: '100%' }}>
                  <option value="" disabled>
                    {recipes.length === 0 ? 'No flavours available' : 'Select…'}
                  </option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div style={{ marginTop: 4 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Type</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['Egg', 'Eggless'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={form.egg_type === t ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => update('egg_type', t)}
                    style={{ padding: '7px 16px', fontSize: 13 }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Weight / size</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                {WEIGHT_PRESETS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={!customWeight && form.weight_kg === w ? 'btn-primary' : 'btn-secondary'}
                    onClick={() => {
                      setCustomWeight(false);
                      update('weight_kg', w);
                    }}
                    style={{ padding: '7px 16px', fontSize: 13 }}
                  >
                    {w} Kg
                  </button>
                ))}
                <button
                  type="button"
                  className={customWeight ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => setCustomWeight(true)}
                  style={{ padding: '7px 16px', fontSize: 13 }}
                >
                  Custom
                </button>
                {customWeight && (
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={form.weight_kg}
                    onChange={(e) => update('weight_kg', Number(e.target.value) || 0)}
                    placeholder="Kg"
                    style={{ width: 90 }}
                  />
                )}
              </div>

              <FormField label="Quantity">
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => update('quantity', Number(e.target.value) || 1)}
                  style={{ width: 100 }}
                />
              </FormField>
            </div>
          </div>

          <div ref={stepRefs[2]} className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 16 }}>Customisation &amp; delivery</h2>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Fulfillment</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['Pickup', 'Delivery'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={form.fulfillment === f ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => update('fulfillment', f)}
                  style={{ padding: '7px 16px', fontSize: 13 }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormField label="Time slot">
                <select value={form.time_slot} onChange={(e) => update('time_slot', e.target.value as FormState['time_slot'])} style={{ width: '100%' }}>
                  {TIME_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Payment method">
                <select
                  value={form.payment_method}
                  onChange={(e) => update('payment_method', e.target.value as FormState['payment_method'])}
                  style={{ width: '100%' }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Advance amount (₹)">
                <input
                  type="number"
                  min={0}
                  value={form.advance_amount}
                  onChange={(e) => update('advance_amount', Number(e.target.value) || 0)}
                  style={{ width: '100%' }}
                />
              </FormField>
            </div>
            <FormField label="Additional notes">
              <textarea
                value={form.additional_notes}
                onChange={(e) => update('additional_notes', e.target.value)}
                rows={2}
                placeholder="Allergies, special requests…"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </FormField>
          </div>

          <div ref={stepRefs[3]} className="card" style={{ padding: 24, marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Family &amp; important dates</h2>
            <p style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
              We&apos;ll quietly remind you so you never miss a moment — all optional.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <FormField label="Partner's birthday">
                <input
                  type="date"
                  value={form.partner_birthday}
                  onChange={(e) => update('partner_birthday', e.target.value)}
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Anniversary">
                <input type="date" value={form.anniversary} onChange={(e) => update('anniversary', e.target.value)} style={{ width: '100%' }} />
              </FormField>
              <FormField label="Children's birthdays">
                <input
                  value={form.childrens_birthdays}
                  onChange={(e) => update('childrens_birthdays', e.target.value)}
                  placeholder="Name(s) & date(s)"
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Other family occasions">
                <input
                  value={form.other_family_occasions}
                  onChange={(e) => update('other_family_occasions', e.target.value)}
                  placeholder="Parents, siblings…"
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Recurring events">
                <input
                  value={form.recurring_events}
                  onChange={(e) => update('recurring_events', e.target.value)}
                  placeholder="House warming, festivals…"
                  style={{ width: '100%' }}
                />
              </FormField>
              <FormField label="Special reminders">
                <input
                  value={form.special_reminders}
                  onChange={(e) => update('special_reminders', e.target.value)}
                  placeholder="Anything else we should remember"
                  style={{ width: '100%' }}
                />
              </FormField>
            </div>
          </div>

          {error && <p style={{ color: 'var(--color-red-text)', fontSize: 13, marginBottom: 12 }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
