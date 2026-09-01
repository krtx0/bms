import { requireAuth, unauthorized } from '@/lib/auth';
import { createOne, updateOne } from '@/lib/crud';
import { COLLECTIONS, getClient, getDb } from '@/lib/db';
import { toApiDocs } from '@/lib/serialize';
import { ITEM_TYPE_COLLECTIONS, lookupItem } from '@/lib/services/inventory';
import { nextPurchaseNumber } from '@/lib/services/numbering';
import type { Purchase, PurchaseLineItem } from '@/types';

// Purchases: the source of truth for new stock batches and current ingredient/packaging cost.
// Deliberately no PATCH/DELETE — a received purchase has already mutated inventory (created
// batches that may already be partially FIFO-consumed by the time someone notices a mistake);
// correcting it goes through POST /api/inventory/adjustments instead of unwinding specific
// batches. Mirrors backend/app/routers/purchases.py.

const VALID_LINE_ITEM_TYPES = new Set<string>(['ingredient', 'packaging']);

interface PurchaseCreatePayload {
  supplier_id?: string | null;
  purchase_date: string;
  line_items: PurchaseLineItem[];
  notes?: string;
}

export async function GET() {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const db = await getDb();
  const docs = await db.collection(COLLECTIONS.purchases).find().sort({ purchase_date: -1 }).toArray();
  return Response.json(toApiDocs(docs));
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!session) return unauthorized();

  const payload = (await request.json()) as PurchaseCreatePayload;
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    return Response.json({ detail: 'At least one line item is required' }, { status: 400 });
  }

  // Resolve + validate every referenced item before writing anything — same discipline as the
  // old FastAPI backend used (it had no choice; here it's a belt-and-braces check on top of the
  // transaction below, which is what actually gives the write phase its atomicity).
  for (const line of payload.line_items) {
    if (!VALID_LINE_ITEM_TYPES.has(line.item_type)) {
      return Response.json({ detail: 'Invalid item_type' }, { status: 400 });
    }
    const item = await lookupItem(line.item_type, line.item_id);
    if (!item) {
      return Response.json({ detail: `${line.item_type} ${line.item_id} not found` }, { status: 404 });
    }
  }

  const purchaseDate = new Date(payload.purchase_date);
  // Server-computed, never trust a client-sent total.
  const totalCost = payload.line_items.reduce((sum, line) => sum + line.quantity * line.unit_cost, 0);

  const client = await getClient();
  const dbSession = client.startSession();
  try {
    const purchase = await dbSession.withTransaction<Purchase>(async () => {
      const purchaseNumber = await nextPurchaseNumber(purchaseDate, dbSession);
      const created = await createOne<Purchase>(
        COLLECTIONS.purchases,
        {
          purchase_number: purchaseNumber,
          supplier_id: payload.supplier_id || null,
          purchase_date: purchaseDate,
          line_items: payload.line_items,
          total_cost: totalCost,
          notes: payload.notes ?? '',
        },
        dbSession
      );

      for (const line of payload.line_items) {
        const batch = await createOne<{ id: string }>(
          COLLECTIONS.inventoryBatches,
          {
            item_type: line.item_type,
            item_id: line.item_id,
            quantity_received: line.quantity,
            remaining_qty: line.quantity,
            unit_cost: line.unit_cost,
            received_date: purchaseDate,
            source_type: 'purchase',
            source_id: created.id,
          },
          dbSession
        );
        await createOne(
          COLLECTIONS.inventoryMovements,
          {
            item_type: line.item_type,
            item_id: line.item_id,
            batch_id: batch.id,
            quantity_delta: line.quantity,
            reason: 'purchase_received',
            reference_id: created.id,
          },
          dbSession
        );
        // This purchase is the new source of truth for "current" cost (matches
        // /recipes/{id}/cost reading live current_cost_per_unit) — a new purchase should move
        // future cost calcs.
        await updateOne(
          ITEM_TYPE_COLLECTIONS[line.item_type],
          line.item_id,
          { current_cost_per_unit: line.unit_cost },
          dbSession
        );
      }

      return created;
    });

    return Response.json(purchase, { status: 201 });
  } finally {
    await dbSession.endSession();
  }
}
