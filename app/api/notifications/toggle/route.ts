import { requireAuth, unauthorized } from '@/lib/auth';
import { COLLECTIONS, getDb } from '@/lib/db';

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = await request.json().catch(() => null);
  const key = payload?.key;
  if (typeof key !== 'string' || !key) {
    return Response.json({ detail: 'key is required' }, { status: 400 });
  }

  const db = await getDb();
  if (payload.completed) {
    await db
      .collection(COLLECTIONS.notificationCompletions)
      .updateOne({ key }, { $setOnInsert: { key, completed_at: new Date() } }, { upsert: true });
  } else {
    await db.collection(COLLECTIONS.notificationCompletions).deleteOne({ key });
  }

  return Response.json({ key, completed: Boolean(payload.completed) });
}
