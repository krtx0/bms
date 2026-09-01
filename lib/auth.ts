import 'server-only';
import bcrypt from 'bcryptjs';
import { getSession } from './session';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

// Route-handler auth guard — mirrors the old FastAPI get_current_admin dependency. Call at the
// top of every protected route handler:
//   const session = await requireAuth();
//   if (!session) return unauthorized();
export async function requireAuth() {
  return getSession();
}

export function unauthorized(): Response {
  return Response.json({ detail: 'Not authenticated' }, { status: 401 });
}

// ponytail: single-process in-memory limiter, resets on restart; upgrade to a shared store
// (Redis, etc.) if this ever runs multi-instance. Ported as-is from the FastAPI backend.
const loginAttempts = new Map<string, number[]>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function isRateLimited(email: string): boolean {
  const now = Date.now();
  const attempts = (loginAttempts.get(email) || []).filter((t) => now - t < WINDOW_MS);
  loginAttempts.set(email, attempts);
  return attempts.length >= MAX_ATTEMPTS;
}

export function recordLoginAttempt(email: string): void {
  const attempts = loginAttempts.get(email) || [];
  attempts.push(Date.now());
  loginAttempts.set(email, attempts);
}

export function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}
