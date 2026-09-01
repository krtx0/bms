// Computes "today's checklist" — an owner-facing digest surfaced from the bell icon on every
// page (not just the dashboard). Every item's key embeds today's date, so completions are a
// per-day "mark done for today" action: a still-low ingredient or an unconfirmed order
// reappears fresh tomorrow rather than staying silently dismissed forever. Reuses
// computeStockLevels() (the same aggregation the Inventory page and dashboard summary use)
// rather than re-deriving stock state.

import { COLLECTIONS, getDb } from '@/lib/db';
import { computeStockLevels } from '@/lib/services/inventory';
import type { Customer, NotificationItem, Order } from '@/types';

const BIRTHDAY_LOOKAHEAD_DAYS = 7;
const DELIVERY_LOOKAHEAD_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

function todayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // "2026-08-25"
}

// Next occurrence of a recurring (month/day) date, ignoring year — mirrors the same logic
// future-leads/page.tsx uses client-side, kept separate since that one runs in the browser in
// local time and this one needs to run server-side in UTC (this app's date convention).
function nextOccurrence(dateStr: string, now: Date): Date {
  const d = new Date(dateStr);
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const next = new Date(Date.UTC(todayStart.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (next < todayStart) next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

export type NotificationDraft = Omit<NotificationItem, 'completed'>;

export async function computeNotifications(now: Date = new Date()): Promise<NotificationDraft[]> {
  const db = await getDb();
  const today = todayKey(now);
  const items: NotificationDraft[] = [];

  const customers = await db.collection(COLLECTIONS.customers).find().toArray();
  const customerName = (id: unknown) => customers.find((c) => String(c._id) === String(id))?.name ?? 'Unknown customer';

  for (const c of customers) {
    for (const d of (c.important_dates ?? []) as Customer['important_dates']) {
      const next = nextOccurrence(d.date, now);
      const daysAway = Math.round((next.getTime() - now.getTime()) / DAY_MS);
      if (daysAway < 0 || daysAway > BIRTHDAY_LOOKAHEAD_DAYS) continue;
      items.push({
        key: `birthday:${c._id}-${d.label}:${today}`,
        type: 'birthday',
        title: `${c.name} — ${d.label} ${daysAway === 0 ? 'today' : daysAway === 1 ? 'tomorrow' : `in ${daysAway} days`}`,
        subtitle: next.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      });
    }
  }

  const stockLevels = await computeStockLevels();
  for (const s of stockLevels.filter((r) => r.is_low_stock)) {
    items.push({
      key: `lowstock:${s.item_type}-${s.item_id}:${today}`,
      type: 'low_stock',
      title: `Reorder ${s.name}`,
      subtitle: `${s.current_stock} / ${s.reorder_threshold} ${s.unit} remaining`,
    });
  }

  const pendingOrders = (await db.collection(COLLECTIONS.orders).find({ status: 'Pending' }).toArray()) as unknown as (Order & {
    _id: unknown;
  })[];
  for (const o of pendingOrders) {
    items.push({
      key: `pending:${o._id}:${today}`,
      type: 'pending_confirmation',
      title: `Confirm order ${o.order_number}`,
      subtitle: `${customerName(o.customer_id)} · ₹${o.selling_price}`,
    });
  }

  const soonCutoff = new Date(now.getTime() + DELIVERY_LOOKAHEAD_DAYS * DAY_MS);
  const soonOrders = (await db
    .collection(COLLECTIONS.orders)
    .find({ delivery_date: { $gte: now, $lte: soonCutoff }, status: { $nin: ['Delivered', 'Cancelled'] } })
    .toArray()) as unknown as (Order & { _id: unknown })[];
  for (const o of soonOrders) {
    items.push({
      key: `delivery:${o._id}:${today}`,
      type: 'delivery_soon',
      title: `Deliver ${o.order_number} soon`,
      subtitle: `${customerName(o.customer_id)} · due ${new Date(o.delivery_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
    });
  }

  return items;
}
