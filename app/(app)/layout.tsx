import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';

// proxy.ts already redirects unauthenticated visitors to /login before this ever renders — this
// layout just supplies the sidebar shell for every "real" page (everything except /login).
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
