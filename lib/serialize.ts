import { ObjectId } from 'mongodb';

// Converts a Mongo document's `_id: ObjectId` to a plain `id: string` for JSON responses, and
// stringifies any nested ObjectId values (foreign-key-style references) recursively. The Python
// backend this app replaces originally leaked `_id` into every response by accident — this is
// the one place that conversion happens here, so it can't happen per-route by omission.
export function toApiDoc<T extends Record<string, unknown>>(doc: T): Record<string, unknown> {
  const { _id, ...rest } = doc as Record<string, unknown> & { _id?: ObjectId };
  return { id: _id ? String(_id) : undefined, ...(deepStringifyIds(rest) as Record<string, unknown>) };
}

export function toApiDocs<T extends Record<string, unknown>>(docs: T[]): Record<string, unknown>[] {
  return docs.map((d) => toApiDoc(d));
}

function deepStringifyIds(value: unknown): unknown {
  if (value instanceof ObjectId) return String(value);
  if (Array.isArray(value)) return value.map(deepStringifyIds);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepStringifyIds(v)]));
  }
  return value;
}

export function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}
