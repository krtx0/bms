// Business-info/workspace half of the settings singleton doc. Ported from
// backend/app/routers/settings.py + backend/app/models/settings.py.
//
// That same doc also carries `counters` (services/numbering.ts) — the atomic order/invoice/
// purchase sequence state, incremented on every order/invoice/purchase created so far. This file
// must NEVER touch that sub-object: only ever $set the business_info/workspace top-level keys
// (never a bare full-document $set, never replaceOne), or the next created order/invoice/
// purchase would either collide with an existing number or silently restart numbering from 1.

import { COLLECTIONS, getDb } from '@/lib/db';
import { SETTINGS_ID } from '@/lib/services/numbering';
import { DEFAULT_BUSINESS_INFO, DEFAULT_WORKSPACE, withDefaults } from '@/lib/services/settingsDefaults';
import type { BusinessInfo, Settings, Workspace } from '@/types';

interface SettingsDoc {
  _id: string;
  business_info?: Partial<BusinessInfo>;
  workspace?: Partial<Workspace>;
  // counters?: {...} also lives on this doc — deliberately not modeled here so it can never be
  // read into `updates` below and written back.
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const doc = await db
    .collection<SettingsDoc>(COLLECTIONS.settings)
    .findOne({ _id: SETTINGS_ID }, { projection: { business_info: 1, workspace: 1 } });
  return withDefaults(doc);
}

export async function updateSettings(patch: {
  business_info?: Partial<BusinessInfo>;
  workspace?: Partial<Workspace>;
}): Promise<Settings> {
  const db = await getDb();
  const collection = db.collection<SettingsDoc>(COLLECTIONS.settings);

  const updates: Record<string, unknown> = {};
  // Each key is set as a whole object (defaulted, not deep-merged against the currently stored
  // doc) — matches the Python side's `BusinessInfo(**payload["business_info"]).model_dump()`.
  if (patch.business_info) updates.business_info = { ...DEFAULT_BUSINESS_INFO, ...patch.business_info };
  if (patch.workspace) updates.workspace = { ...DEFAULT_WORKSPACE, ...patch.workspace };

  if (Object.keys(updates).length === 0) {
    // Nothing to write — e.g. an empty body. Skip the update (an empty $set errors on Mongo) and
    // just report current state.
    const doc = await collection.findOne({ _id: SETTINGS_ID }, { projection: { business_info: 1, workspace: 1 } });
    return withDefaults(doc);
  }

  const doc = await collection.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $set: updates },
    { upsert: true, returnDocument: 'after', projection: { business_info: 1, workspace: 1 } }
  );
  return withDefaults(doc);
}
