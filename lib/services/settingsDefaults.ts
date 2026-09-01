// Pure defaulting logic for the settings singleton doc's business_info/workspace fields — split
// out from settings.ts so this stays testable without real DB credentials: settings.ts imports
// @/lib/db at module scope, which throws immediately if MONGODB_URI isn't set (as it isn't in a
// plain `vitest run` process); this file deliberately has no such import, mirroring how
// costing.ts/production.ts stay pure and DB-free so they can be unit tested directly.

import type { BusinessInfo, Settings, Workspace } from '@/types';

export const DEFAULT_BUSINESS_INFO: BusinessInfo = {
  name: 'Mélange Patisserie',
  tagline: '',
  email: '',
  phone: '',
  address: '',
  gstin: '', // India-specific GST tax id, matches the reference video's Settings screen
};

export const DEFAULT_WORKSPACE: Workspace = { currency: 'INR', timezone: 'Asia/Kolkata' };

// Fills in defaults for whatever's missing — covers both "doc doesn't exist yet" and "doc exists
// with only counters" (the common case: every prior phase already incremented counters on this
// doc before Settings ever wrote business_info/workspace).
export function withDefaults(
  doc: { business_info?: Partial<BusinessInfo>; workspace?: Partial<Workspace> } | null
): Settings {
  return {
    business_info: { ...DEFAULT_BUSINESS_INFO, ...doc?.business_info },
    workspace: { ...DEFAULT_WORKSPACE, ...doc?.workspace },
  };
}
