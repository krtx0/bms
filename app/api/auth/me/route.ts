import { getDb, COLLECTIONS } from '@/lib/db';
import { requireAuth, unauthorized } from '@/lib/auth';

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const db = await getDb();
  const user = await db.collection(COLLECTIONS.users).findOne({ email: session.email });
  if (!user) return unauthorized();

  return Response.json({ email: user.email, full_name: user.full_name || '', role: user.role || 'admin' });
}
