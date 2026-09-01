import { requireAuth, unauthorized } from '@/lib/auth';
import { createOne } from '@/lib/crud';
import { COLLECTIONS, getClient, getDb } from '@/lib/db';
import { toObjectId } from '@/lib/serialize';
import { lookupItem, stockLevelRow, unitCostFor } from '@/lib/services/inventory';
import { deductFifo } from '@/lib/services/inventoryFifo';
import type { ItemType } from '@/types';

const VALID_ITEM_TYPES = new Set<string>(['ingredient', 'packaging', 'semi_finished']);

interface AdjustmentPayload {
  item_type: ItemType;
  item_id: string;
  quantity_delta: number;
  // Accepted for the caller's own context but not persisted — InventoryMovement.reason is the
  // fixed "manual_adjustment" literal below; neither model has a free-text notes field.
  reason?: string;
}

// Mirrors backend/app/routers/inventory.py's POST /adjustments. Atlas supports multi-document
// transactions (confirmed with a one-off check) so the batch-create-or-FIFO-deduct + movement
// write(s) happen atomically here, unlike the old FastAPI backend's sequential-write workaround.
export async function POST(request: Request) {
  const authSession = await requireAuth();
  if (!authSession) return unauthorized();

  const payload = (await request.json()) as AdjustmentPayload;
  if (!VALID_ITEM_TYPES.has(payload.item_type)) {
    return Response.json({ detail: 'Invalid item_type' }, { status: 400 });
  }

  const item = await lookupItem(payload.item_type, payload.item_id);
  if (!item) return Response.json({ detail: 'Item not found' }, { status: 404 });

  const client = await getClient();
  const dbSession = client.startSession();
  try {
    await dbSession.withTransaction(async () => {
      if (payload.quantity_delta > 0) {
        const batch = await createOne<{ id: string }>(
          COLLECTIONS.inventoryBatches,
          {
            item_type: payload.item_type,
            item_id: payload.item_id,
            quantity_received: payload.quantity_delta,
            remaining_qty: payload.quantity_delta,
            unit_cost: await unitCostFor(payload.item_type, item),
            received_date: new Date(),
            source_type: 'adjustment',
            source_id: null,
          },
          dbSession
        );
        await createOne(
          COLLECTIONS.inventoryMovements,
          {
            item_type: payload.item_type,
            item_id: payload.item_id,
            batch_id: batch.id,
            quantity_delta: payload.quantity_delta,
            reason: 'manual_adjustment',
            reference_id: null,
          },
          dbSession
        );
      } else if (payload.quantity_delta < 0) {
        const db = await getDb();
        const existing = await db
          .collection(COLLECTIONS.inventoryBatches)
          .find(
            { item_type: payload.item_type, item_id: payload.item_id, remaining_qty: { $gt: 0 } },
            { session: dbSession }
          )
          .sort({ received_date: 1 })
          .toArray();
        const sortedBatches = existing.map((b) => ({ batchId: String(b._id), remainingQty: b.remaining_qty as number }));
        const { deductions } = deductFifo(sortedBatches, Math.abs(payload.quantity_delta));
        // ponytail: over-drawing (removing more than is on hand) silently deducts only what
        // exists rather than erroring — deductFifo already caps there, so stock just floors at
        // zero. Add a 400 on a nonzero unfulfilledRemainder if that should be a hard error.
        for (const deduction of deductions) {
          // batchId came from String(doc._id) just above — always a valid ObjectId string.
          await db
            .collection(COLLECTIONS.inventoryBatches)
            .updateOne(
              { _id: toObjectId(deduction.batchId)! },
              { $inc: { remaining_qty: -deduction.qtyDeducted } },
              { session: dbSession }
            );
          await createOne(
            COLLECTIONS.inventoryMovements,
            {
              item_type: payload.item_type,
              item_id: payload.item_id,
              batch_id: deduction.batchId,
              quantity_delta: -deduction.qtyDeducted,
              reason: 'manual_adjustment',
              reference_id: null,
            },
            dbSession
          );
        }
      }
      // quantity_delta == 0 is a no-op; still returns the current stock level below.
    });
  } catch (err) {
    return Response.json({ detail: err instanceof Error ? err.message : 'Something went wrong' }, { status: 404 });
  } finally {
    await dbSession.endSession();
  }

  return Response.json(await stockLevelRow(payload.item_type, payload.item_id));
}
