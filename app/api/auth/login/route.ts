import { getDb, COLLECTIONS, ensureIndexes } from '@/lib/db';
import { hashPassword, verifyPassword, isRateLimited, recordLoginAttempt, clearLoginAttempts } from '@/lib/auth';
import { createSession } from '@/lib/session';

// Lazily bootstraps the single admin user (+ indexes) from env vars on first login if `users`
// is empty. No signup endpoint, ever — there is exactly one admin. This replaces the old FastAPI
// lifespan startup hook: a serverless deployment has no persistent "process startup" to hook
// into, so bootstrapping on first use is the more portable equivalent. Only runs the (idempotent
// but not free) index creation once, on that same first login, not on every request.
async function bootstrapAdminIfNeeded() {
  const db = await getDb();
  const count = await db.collection(COLLECTIONS.users).countDocuments({});
  if (count === 0) {
    await ensureIndexes();
    await db.collection(COLLECTIONS.users).insertOne({
      email: (process.env.ADMIN_EMAIL || 'admin@melange.local').trim().toLowerCase(),
      hashed_password: await hashPassword(process.env.ADMIN_PASSWORD || 'change-me'),
      full_name: 'Business Owner',
      role: 'admin',
      created_at: new Date(),
    });
  }
}

export async function POST(request: Request) {
  const { email: rawEmail, password } = await request.json();
  const email = String(rawEmail || '').trim().toLowerCase();

  if (isRateLimited(email)) {
    return Response.json({ detail: 'Too many login attempts, try again later' }, { status: 429 });
  }

  await bootstrapAdminIfNeeded();

  const db = await getDb();
  const user = await db.collection(COLLECTIONS.users).findOne({ email });

  if (!user || !(await verifyPassword(password, user.hashed_password))) {
    recordLoginAttempt(email);
    return Response.json({ detail: 'Invalid email or password' }, { status: 401 });
  }

  clearLoginAttempts(email);
  await createSession(email);

  return Response.json({ email: user.email, full_name: user.full_name || '', role: user.role || 'admin' });
}
