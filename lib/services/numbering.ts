// Atomic document-number generators backed by a single-document counter. Ported from
// backend/app/services/numbering.py.

import type { ClientSession } from 'mongodb';
import { COLLECTIONS, getDb } from '@/lib/db';

// fixed string _id, not ObjectId — simpler to target this one doc. Exported so lib/services/
// settings.ts (Phase 6) targets the exact same doc instead of risking a typo'd duplicate.
export const SETTINGS_ID = 'singleton';

interface SettingsCountersDoc {
  _id: string;
  counters?: { purchase_seq?: number; order_seq?: number; invoice_seq?: number };
}

/**
 * Atomically increments counters.purchase_seq on the settings singleton doc and formats
 * "PUR-{year}-{seq:04d}", e.g. "PUR-2026-0001". upsert:true so this works even before Settings
 * (a later phase) creates the settings document through its own UI. Year comes from
 * purchaseDate's year (the date being recorded), not "now". This same singleton document is
 * extended by that later phase (order_seq, invoice_seq, business info, …) — keep its shape
 * (fixed string _id, counters.* sub-object) compatible.
 */
export async function nextPurchaseNumber(purchaseDate: Date, session?: ClientSession): Promise<string> {
  const db = await getDb();
  const doc = await db.collection<SettingsCountersDoc>(COLLECTIONS.settings).findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $inc: { 'counters.purchase_seq': 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  const seq = doc!.counters!.purchase_seq!;
  return `PUR-${purchaseDate.getFullYear()}-${String(seq).padStart(4, '0')}`;
}

/** Same pattern as nextPurchaseNumber: counters.order_seq, "ORD-{year}-{seq:04d}". */
export async function nextOrderNumber(date: Date, session?: ClientSession): Promise<string> {
  const db = await getDb();
  const doc = await db.collection<SettingsCountersDoc>(COLLECTIONS.settings).findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $inc: { 'counters.order_seq': 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  const seq = doc!.counters!.order_seq!;
  return `ORD-${date.getFullYear()}-${String(seq).padStart(4, '0')}`;
}

/** Same pattern as nextPurchaseNumber: counters.invoice_seq, "INV-{year}-{seq:04d}". */
export async function nextInvoiceNumber(date: Date, session?: ClientSession): Promise<string> {
  const db = await getDb();
  const doc = await db.collection<SettingsCountersDoc>(COLLECTIONS.settings).findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $inc: { 'counters.invoice_seq': 1 } },
    { upsert: true, returnDocument: 'after', session }
  );
  const seq = doc!.counters!.invoice_seq!;
  return `INV-${date.getFullYear()}-${String(seq).padStart(4, '0')}`;
}
