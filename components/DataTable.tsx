'use client';

import { useMemo, useState, type ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  rows,
  keyField,
  onRowClick,
  searchPlaceholder,
  emptyMessage = 'No records yet.',
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      Object.values(row as Record<string, unknown>).some((v) => typeof v === 'string' && v.toLowerCase().includes(q))
    );
  }, [rows, query]);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {searchPlaceholder && (
        <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ width: '100%', maxWidth: 320 }}
          />
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    textAlign: col.align ?? 'left',
                    padding: '10px 20px',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 600,
                    borderBottom: '1px solid var(--color-border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={String(row[keyField])}
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default', borderBottom: '1px solid var(--color-border)' }}
                >
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: '14px 20px', textAlign: col.align ?? 'left', fontSize: 14 }}>
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
