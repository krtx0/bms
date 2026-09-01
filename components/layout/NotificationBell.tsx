'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { useApiResource } from '@/hooks/useApiResource';
import { api } from '@/lib/apiClient';
import type { NotificationItem } from '@/types';

// Today's checklist, reachable from every page. Ticking an item just toggles a completion
// record for its (date-scoped) key — see lib/services/notifications.ts for why each key embeds
// today's date rather than being a one-time dismissal.
export function NotificationBell() {
  const { data, reload } = useApiResource<NotificationItem[]>('/api/notifications');
  const [open, setOpen] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const items = data ?? [];
  const outstandingCount = items.filter((i) => !i.completed).length;

  async function toggle(item: NotificationItem) {
    setPendingKeys((prev) => new Set(prev).add(item.key));
    try {
      await api.post('/api/notifications/toggle', { key: item.key, completed: !item.completed });
      await reload();
    } finally {
      setPendingKeys((prev) => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          background: 'none',
          border: '1px solid var(--color-border)',
          borderRadius: 999,
          width: 36,
          height: 36,
        }}
      >
        <Icon name="bell" size={17} />
        {outstandingCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: '0 3px',
              borderRadius: 999,
              background: 'var(--color-red-text)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {outstandingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 320,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 420,
            overflowY: 'auto',
            background: '#fff',
            padding: 12,
            zIndex: 90,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, padding: '0 4px' }}>Today&apos;s tasks</div>
          {items.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 4px' }}>Nothing needs attention today.</p>
          ) : (
            items.map((item) => (
              <label
                key={item.key}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '8px 4px',
                  cursor: 'pointer',
                  opacity: pendingKeys.has(item.key) ? 0.5 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={item.completed}
                  disabled={pendingKeys.has(item.key)}
                  onChange={() => toggle(item)}
                  style={{ marginTop: 2 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      textDecoration: item.completed ? 'line-through' : 'none',
                      color: item.completed ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
                    }}
                  >
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{item.subtitle}</div>
                </div>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
