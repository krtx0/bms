'use client';

import type { ReactNode } from 'react';

interface FormModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  submitting?: boolean;
  children: ReactNode;
  submitLabel?: string;
}

export function FormModal({
  open,
  title,
  onClose,
  onSubmit,
  submitting,
  children,
  submitLabel = 'Save',
}: FormModalProps) {
  if (!open) return null;

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
      <form
        className="card"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        style={{ width: 480, maxWidth: '100%', maxHeight: '86vh', overflowY: 'auto', background: '#fff', padding: 28 }}
      >
        <h2 style={{ fontSize: 19, marginBottom: 20 }}>{title}</h2>
        {children}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

// Small label+field wrapper used by every form built on top of FormModal.
export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
