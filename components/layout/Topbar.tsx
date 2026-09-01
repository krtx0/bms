'use client';

import type { ReactNode } from 'react';
import { Icon } from '../Icon';
import { NotificationBell } from './NotificationBell';

export function Topbar({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header
      className="app-topbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--color-border)',
        gap: 24,
      }}
    >
      <div>
        <h1 style={{ fontSize: 24 }}>{title}</h1>
        {subtitle && <p style={{ margin: '4px 0 0', color: 'var(--color-text-secondary)', fontSize: 13.5 }}>{subtitle}</p>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid var(--color-border)',
            borderRadius: 999,
            padding: '8px 14px',
            color: 'var(--color-text-secondary)',
            flex: '1 1 160px',
            maxWidth: 260,
          }}
        >
          <Icon name="search" size={16} />
          <span style={{ fontSize: 13.5 }}>Search orders, customers…</span>
        </div>

        <NotificationBell />

        <span className="pill pill-tan">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-green-text)', display: 'inline-block' }} />
          Live data
        </span>

        {action}
      </div>
    </header>
  );
}
