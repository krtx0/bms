import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS, getDb } from '@/lib/db';
import { computeNotifications } from '@/lib/services/notifications';
import type { NotificationItem } from '@/types';

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const items = await computeNotifications();
  const keys = items.map((i) => i.key);
  const db = await getDb();
  const completions =
    keys.length > 0 ? await db.collection(COLLECTIONS.notificationCompletions).find({ key: { $in: keys } }).toArray() : [];
  const completedKeys = new Set(completions.map((c) => c.key as string));

  const result: NotificationItem[] = items
    .map((i) => ({ ...i, completed: completedKeys.has(i.key) }))
    .sort((a, b) => Number(a.completed) - Number(b.completed));

  return Response.json(result);
}
