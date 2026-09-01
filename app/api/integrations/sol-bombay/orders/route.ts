import { COLLECTIONS, getDb } from '@/lib/db';
import { createOrder, transitionStatus, HttpError, type OrderCreatePayload } from '@/lib/services/orderWorkflow';
import { toApiDoc, toObjectId } from '@/lib/serialize';
import type { Recipe } from '@/types';

export async function POST(request: Request) {
  // 1. Authenticate Request via Secret Token
  const authHeader = request.headers.get('x-solbombay-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const secretEnv = process.env.SOL_BOMBAY_INTEGRATION_SECRET || 'solbombay_secret_key_2026';

  if (secretEnv && authHeader !== secretEnv) {
    return Response.json({ detail: 'Unauthorized integration request' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return Response.json({ detail: 'Invalid JSON request body' }, { status: 400 });
  }

  const solOrderNumber = body.sol_bombay_order_id || body.order_id || 'SB-UNKNOWN';
  const customerInfo = body.customer || {};
  const lineItemsInput = body.line_items || [];

  if (!Array.isArray(lineItemsInput) || lineItemsInput.length === 0) {
    return Response.json({ detail: 'At least one line item with a short_code is required' }, { status: 400 });
  }

  const db = await getDb();
  const lineItemsPayload = [];
  const unmappedCodes: string[] = [];

  for (const item of lineItemsInput) {
    const shortCode = (item.short_code || item.flavour_code || '').trim();
    let recipeDoc: Recipe | null = null;

    if (shortCode) {
      // Strategy A: Match by flavour_code (case-insensitive)
      const foundByCode = await db.collection(COLLECTIONS.recipes).findOne({
        flavour_code: { $regex: new RegExp(`^${shortCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (foundByCode) {
        recipeDoc = toApiDoc(foundByCode) as unknown as Recipe;
      }

      // Strategy B: Match by Mongo _id if shortCode is hex id
      if (!recipeDoc && shortCode.length === 24) {
        const oid = toObjectId(shortCode);
        if (oid) {
          const foundById = await db.collection(COLLECTIONS.recipes).findOne({ _id: oid });
          if (foundById) {
            recipeDoc = toApiDoc(foundById) as unknown as Recipe;
          }
        }
      }
    }

    // Strategy C: Fallback to first available recipe if shortCode is missing/unmapped
    if (!recipeDoc) {
      const fallback = await db.collection(COLLECTIONS.recipes).findOne({});
      if (fallback) {
        recipeDoc = toApiDoc(fallback) as unknown as Recipe;
        if (shortCode) unmappedCodes.push(shortCode);
      }
    }

    if (!recipeDoc) {
      return Response.json({ detail: `No recipes configured in system to process item: ${shortCode}` }, { status: 404 });
    }

    const weight = Math.max(0.1, Number(item.weight || item.weight_kg || 1.0));
    const quantity = Math.max(1, Number(item.quantity || item.qty || 1));
    const sellingPrice = Math.max(0, Number(item.selling_price || item.price || recipeDoc.base_cake_price || 0));
    const customizations = [
      shortCode ? `ShortCode: ${shortCode}` : '',
      item.customizations || item.selected_specifications || ''
    ].filter(Boolean).join(' | ');

    lineItemsPayload.push({
      recipe_id: recipeDoc.id,
      weight,
      quantity,
      selling_price: sellingPrice,
      customizations
    });
  }

  const deliveryDateStr = body.delivery_date || body.event_date || new Date().toISOString().split('T')[0];
  const notesArr = [
    `[Sol Bombay Order: ${solOrderNumber}]`,
    body.razorpay_payment_id ? `Razorpay Payment ID: ${body.razorpay_payment_id}` : '',
    unmappedCodes.length > 0 ? `Unmapped product codes fallback: ${unmappedCodes.join(', ')}` : '',
    body.notes || ''
  ].filter(Boolean);

  const orderPayload: OrderCreatePayload = {
    customer: {
      name: customerInfo.name || 'Sol Bombay Customer',
      phone: customerInfo.phone || '',
      email: customerInfo.email || '',
      address: customerInfo.address || '',
      notes: `Imported from Sol Bombay (${solOrderNumber})`
    },
    event_date: deliveryDateStr,
    delivery_date: deliveryDateStr,
    line_items: lineItemsPayload,
    notes: notesArr.join('\n'),
    priority: 'medium',
    source: 'sol_bombay'
  };

  try {
    const order = await createOrder(orderPayload);

    // If payment status is paid in Sol Bombay, transition status to 'Confirmed'
    if (body.payment_status === 'paid' || body.payment_status === 'Confirmed') {
      try {
        await transitionStatus(order.id, 'Confirmed');
      } catch (stErr) {
        console.warn(`[SolBombay Integration] Warning updating order status:`, stErr);
      }
    }

    return Response.json({
      success: true,
      sol_bombay_order_id: solOrderNumber,
      melange_order_id: order.id,
      melange_order_number: order.order_number,
      unmapped_codes: unmappedCodes
    }, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) {
      return Response.json({ detail: err.message }, { status: err.status });
    }
    console.error('[SolBombay Integration Error]:', err);
    return Response.json({ detail: 'Failed to create order in Melange BMS' }, { status: 500 });
  }
}
