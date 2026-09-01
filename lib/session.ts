import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'melange_session';
const EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches the previous FastAPI backend

const secretKey = process.env.SESSION_SECRET || 'dev-only-secret-change-me';
const encodedKey = new TextEncoder().encode(secretKey);

interface SessionPayload {
  email: string;
  [key: string]: unknown;
}

async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ['HS256'] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(email: string): Promise<void> {
  const token = await encrypt({ email });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(Date.now() + EXPIRES_MS),
    path: '/',
  });
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Reads the current request's session — null if missing/invalid/expired. Route handlers and
// server components both call this (directly, or via requireAuth() in lib/auth.ts).
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get(COOKIE_NAME)?.value);
}
