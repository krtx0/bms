// Generic async CRUD helpers, parameterized by collection name. Ported from backend/app/crud.py
// (list_all/get_one/create_one/update_one/delete_one/find_by_ids) — used directly by the
// plain-CRUD routes (ingredients/packaging/suppliers), and by components/recipes for their
// plain-CRUD parts before layering their own /cost route on top.
//
// Unlike the Python version there's no Pydantic model to validate/coerce payloads against —
// this app has no runtime schema layer, so route handlers pass the parsed JSON body straight
// through (after stripping server-owned fields), same as the Python side effectively does once
// its model validation passes.

import type { ClientSession } from 'mongodb';
import { getDb } from './db';
import { toApiDoc, toApiDocs, toObjectId } from './serialize';

// Clients don't get to set these via create/update payloads — Mongo/the server own them.
const SERVER_OWNED_FIELDS = new Set(['id', '_id', 'created_at']);

function stripServerOwnedFields(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !SERVER_OWNED_FIELDS.has(key)));
}

export async function listAll<T = Record<string, unknown>>(collection: string): Promise<T[]> {
  const db = await getDb();
  const docs = await db.collection(collection).find().toArray();
  return toApiDocs(docs) as T[];
}

export async function getOne<T = Record<string, unknown>>(collection: string, id: string): Promise<T | null> {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  const db = await getDb();
  const doc = await db.collection(collection).findOne({ _id: objectId });
  return doc ? (toApiDoc(doc) as T) : null;
}

// session is optional — only purchases/route.ts's transactional create and the FIFO adjustment
// path pass one; every other call site is unaffected (undefined session = no transaction).
export async function createOne<T = Record<string, unknown>>(
  collection: string,
  data: Record<string, unknown>,
  session?: ClientSession
): Promise<T> {
  const db = await getDb();
  const doc = { ...stripServerOwnedFields(data), created_at: new Date() };
  const result = await db.collection(collection).insertOne(doc, { session });
  return toApiDoc({ ...doc, _id: result.insertedId }) as T;
}

export async function updateOne<T = Record<string, unknown>>(
  collection: string,
  id: string,
  data: Record<string, unknown>,
  session?: ClientSession
): Promise<T | null> {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  const db = await getDb();
  const changes = stripServerOwnedFields(data);
  const result = await db
    .collection(collection)
    .findOneAndUpdate({ _id: objectId }, { $set: changes }, { returnDocument: 'after', session });
  return result ? (toApiDoc(result) as T) : null;
}

export async function deleteOne(collection: string, id: string): Promise<boolean> {
  const objectId = toObjectId(id);
  if (!objectId) return false;
  const db = await getDb();
  const result = await db.collection(collection).deleteOne({ _id: objectId });
  return result.deletedCount > 0;
}

// Bulk-fetch docs by _id, keyed by string id — resolves embedded references (e.g. a recipe's
// ingredient_id/component_id lines) in one round trip instead of N lookups.
export async function findByIds<T = Record<string, unknown>>(
  collection: string,
  ids: string[]
): Promise<Record<string, T>> {
  const objectIds = [...new Set(ids.map(String))]
    .map(toObjectId)
    .filter((v): v is NonNullable<typeof v> => v !== null);
  if (objectIds.length === 0) return {};
  const db = await getDb();
  const docs = await db
    .collection(collection)
    .find({ _id: { $in: objectIds } })
    .toArray();
  return Object.fromEntries(docs.map((doc) => [String(doc._id), toApiDoc(doc) as T]));
}

// Mongo's duplicate-key error on a unique index (name, flavour_code, …) — the Node driver's
// equivalent of pymongo's DuplicateKeyError, which the Python routers catch to return 409.
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export function notFoundResponse(label: string): Response {
  return Response.json({ detail: `${label} not found` }, { status: 404 });
}

export function conflictResponse(label: string, message?: string): Response {
  return Response.json({ detail: message ?? `${label} name already exists` }, { status: 409 });
}
