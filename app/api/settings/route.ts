import { requireAuth, unauthorized } from '@/lib/auth';
import { getSettings, updateSettings } from '@/lib/services/settings';
import type { BusinessInfo, Workspace } from '@/types';

// Thin route handlers — all the counters-safety logic lives in lib/services/settings.ts (see the
// warning at the top of that file before touching either of these).

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  return Response.json(await getSettings());
}

export async function PUT(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = (await request.json()) as { business_info?: Partial<BusinessInfo>; workspace?: Partial<Workspace> };
  return Response.json(await updateSettings(payload));
}
