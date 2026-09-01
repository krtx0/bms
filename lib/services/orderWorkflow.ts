// Order lifecycle orchestration: creation (with a frozen cost snapshot per line item), status
// transitions (triggering production/inventory consumption), and payments (triggering
// invoicing). Ported from backend/app/services/order_workflow.py.
//
// Unlike the Python version (which had no transactions available — its local MongoDB wasn't a
// replica set), the Production-triggering status transition here runs the status update + every
// FIFO batch/movement write inside ONE real transaction (this Atlas cluster is a replica set,
// confirmed last phase) — see transitionStatus below. Everything else (createOrder,
// recordPayment) stays non-transactional, same discipline as purchases.ts: resolve/validate
// everything first, then write sequentially — there's only ever one write (or a
// resolve-then-single-write) in those paths, so there's nothing for a transaction to protect.

import type { ClientSession } from 'mongodb';
import { createOne, findByIds, getOne, updateOne } from '@/lib/crud';
import { COLLECTIONS, getClient, getDb } from '@/lib/db';
import {
  calculateCakeCost,
  calculateComponentCostForRecipe,
  calculateCustomizationCost,
  calculateEstimatedProfit,
  calculateTotalProductCost,
  determinePaymentStatus,
} from '@/lib/services/costing';
import { resolveComponentLines, resolveIngredientLines } from '@/lib/services/costResolution';
import { deductFifo, resolveComponentShortfallToIngredients, type FifoBatch } from '@/lib/services/inventoryFifo';
import { nextOrderNumber } from '@/lib/services/numbering';
import { calculateFullIngredientRequirement } from '@/lib/services/production';
import { toApiDoc, toObjectId } from '@/lib/serialize';
import type {
  Component,
  Customer,
  ImportantDate,
  Ingredient,
  Order,
  OrderLineItem,
  OrderPriority,
  ProductionShortfallItem,
  Recipe,
} from '@/types';

const VALID_PRIORITIES = new Set(['low', 'medium', 'high']);

// Thin TS analog of FastAPI's HTTPException — thrown by the functions below, caught by the
// route handlers that call them and turned into a `{detail}` Response with the right status.
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ShortfallResult = { shortfalls: ProductionShortfallItem[] } | Record<string, never>;

// ------------------------------- createOrder -------------------------------

export interface OrderLineItemPayload {
  recipe_id: string;
  weight: number;
  quantity: number;
  customizations?: string;
  selling_price: number; // PER UNIT rate — order_workflow scales by quantity for line/order totals
}

export interface CustomerInlinePayload {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  is_lead?: boolean;
  important_dates?: ImportantDate[];
}

export interface OrderCreatePayload {
  customer?: CustomerInlinePayload | null;
  customer_id?: string | null;
  event_date: string;
  delivery_date: string;
  line_items: OrderLineItemPayload[];
  notes?: string;
  priority?: OrderPriority;
  source?: 'public_form' | 'admin';
}

async function resolveCustomer(payload: OrderCreatePayload): Promise<Customer> {
  if (payload.customer_id) {
    const customer = await getOne<Customer>(COLLECTIONS.customers, payload.customer_id);
    if (!customer) throw new HttpError(404, 'Customer not found');
    return customer;
  }

  const customerData = payload.customer;
  if (!customerData) throw new HttpError(400, 'Either customer_id or an inline customer is required');

  const phone = customerData.phone || '';
  const db = await getDb();
  const existing = phone ? await db.collection(COLLECTIONS.customers).findOne({ phone }) : null;
  if (existing) {
    const existingCustomer = toApiDoc(existing) as unknown as Customer;
    const newDates = customerData.important_dates ?? [];
    // No new dates/notes to merge — every existing admin-form caller hits this branch, unchanged.
    if (newDates.length === 0 && !customerData.notes) return existingCustomer;

    const seen = new Set(existingCustomer.important_dates.map((d) => `${d.label}|${d.date}`));
    const important_dates = [...existingCustomer.important_dates, ...newDates.filter((d) => !seen.has(`${d.label}|${d.date}`))];
    const notes = customerData.notes ? [existingCustomer.notes, customerData.notes].filter(Boolean).join('\n\n') : existingCustomer.notes;
    return (await updateOne<Customer>(COLLECTIONS.customers, existingCustomer.id, { important_dates, notes })) ?? existingCustomer;
  }

  // Inline-create payload only ever carries a handful of fields (see NewOrderForm) — default the
  // rest exactly like the Customer model's own defaults, so e.g. important_dates is always an
  // array (Future Leads iterates it) rather than absent from the doc.
  return createOne<Customer>(COLLECTIONS.customers, {
    name: customerData.name,
    phone: customerData.phone ?? '',
    email: customerData.email ?? '',
    address: customerData.address ?? '',
    notes: customerData.notes ?? '',
    is_lead: customerData.is_lead ?? false,
    important_dates: customerData.important_dates ?? [],
  });
}

export async function createOrder(payload: OrderCreatePayload): Promise<Order> {
  if (!Array.isArray(payload.line_items) || payload.line_items.length === 0) {
    throw new HttpError(400, 'At least one line item is required');
  }
  if (payload.priority !== undefined && !VALID_PRIORITIES.has(payload.priority)) {
    throw new HttpError(400, 'Invalid priority');
  }

  // Resolve/validate every line item's recipe individually (clean 404 on a bad recipe_id, rather
  // than findByIds' unguarded ObjectId conversion against raw, possibly-malformed input) BEFORE
  // resolveCustomer — resolveCustomer can create a new customer record, and it doesn't need to
  // depend on anything here, so validating recipes first means a bad recipe_id fails cleanly with
  // zero writes instead of leaving an orphaned customer with no matching order.
  const recipes: Recipe[] = [];
  for (const line of payload.line_items) {
    const recipe = await getOne<Recipe>(COLLECTIONS.recipes, String(line.recipe_id));
    if (!recipe) throw new HttpError(404, `Recipe ${line.recipe_id} not found`);
    recipes.push(recipe);
  }

  const customer = await resolveCustomer(payload);

  // Batch-fetch every component/ingredient these recipes reference — DB-sourced ids, safe for findByIds.
  const componentIds = recipes.flatMap((r) => r.components.map((c) => c.component_id));
  const componentsById = await findByIds<Component>(COLLECTIONS.components, componentIds);
  const ingredientIds = [
    ...recipes.flatMap((r) => r.base_ingredients.map((i) => i.ingredient_id)),
    ...Object.values(componentsById).flatMap((c) => c.ingredient_list.map((i) => i.ingredient_id)),
  ];
  const ingredientsById = await findByIds<Ingredient>(COLLECTIONS.ingredients, ingredientIds);

  const lineItems: OrderLineItem[] = recipes.map((recipe, i) => {
    const line = payload.line_items[i];
    let basePairs: ReturnType<typeof resolveIngredientLines>['pairs'];
    let componentPairs: ReturnType<typeof resolveComponentLines>['pairs'];
    try {
      basePairs = resolveIngredientLines(recipe.base_ingredients, ingredientsById).pairs;
      componentPairs = resolveComponentLines(recipe.components, componentsById, ingredientsById).pairs;
    } catch (err) {
      throw new HttpError(404, err instanceof Error ? err.message : 'Not found');
    }

    // CRITICAL — every field below is PER UNIT (mirrors recipes/{id}/cost and the recipe's own
    // base_cake_price). quantity only scales these into real money via line_total_amount/
    // line_total_cost — summing the raw per-unit fields directly into order totals was the
    // original bug (a 3-cake line silently priced like a 1-cake line); see order-level totals
    // below, which sum ONLY the *_total_* fields, never the per-unit ones.
    const cakeCost = calculateCakeCost(basePairs);
    const componentCost = calculateComponentCostForRecipe(componentPairs);
    const totalProductCost = calculateTotalProductCost(cakeCost, componentCost);
    const sellingPrice = line.selling_price;
    const quantity = line.quantity;
    const customizationCost = calculateCustomizationCost(sellingPrice, recipe.base_cake_price);
    const estimatedProfit = calculateEstimatedProfit(sellingPrice, totalProductCost);

    return {
      recipe_id: recipe.id,
      flavour_code: recipe.flavour_code,
      weight: line.weight,
      quantity,
      customizations: line.customizations ?? '',
      base_cake_price: recipe.base_cake_price,
      cake_cost: cakeCost,
      component_cost: componentCost,
      total_product_cost: totalProductCost,
      customization_cost: customizationCost,
      selling_price: sellingPrice,
      estimated_profit: estimatedProfit,
      line_total_amount: sellingPrice * quantity,
      line_total_cost: totalProductCost * quantity,
    };
  });

  // Order-level totals are Σ line_total_amount / Σ line_total_cost — the qty-scaled REAL totals
  // — never summed from the raw per-unit fields.
  const orderSellingPrice = lineItems.reduce((sum, li) => sum + li.line_total_amount, 0);
  const orderTotalProductCost = lineItems.reduce((sum, li) => sum + li.line_total_cost, 0);
  const orderEstimatedProfit = orderSellingPrice - orderTotalProductCost;

  const now = new Date();
  const orderNumber = await nextOrderNumber(now);

  return createOne<Order>(COLLECTIONS.orders, {
    order_number: orderNumber,
    customer_id: customer.id,
    event_date: new Date(payload.event_date),
    delivery_date: new Date(payload.delivery_date),
    status: 'Pending',
    status_history: [{ status: 'Pending', changed_at: now }],
    priority: payload.priority ?? 'medium',
    source: payload.source ?? 'admin',
    line_items: lineItems,
    selling_price: orderSellingPrice,
    total_product_cost: orderTotalProductCost,
    estimated_profit: orderEstimatedProfit,
    payment_status: 'Pending',
    amount_paid: 0,
    notes: payload.notes ?? '',
  });
}

// ------------------------------- transitionStatus -------------------------------

interface ProductionRequirement {
  componentRequirement: Record<string, number>;
  ingredientRequirement: Record<string, number>;
  componentsById: Record<string, Component>;
  ingredientsById: Record<string, Ingredient>;
}

// Pure resolve/compute (reads only, no writes) — deliberately run BEFORE the transaction opens
// below, same discipline as purchases.ts. Only the FIFO deduction + persistence needs atomicity.
async function resolveProductionRequirement(order: Order): Promise<ProductionRequirement> {
  const recipeIds = order.line_items.map((li) => li.recipe_id);
  const recipesById = await findByIds<Recipe>(COLLECTIONS.recipes, recipeIds);

  const componentIds = Object.values(recipesById).flatMap((r) => r.components.map((c) => c.component_id));
  const componentsById = await findByIds<Component>(COLLECTIONS.components, componentIds);

  const ingredientIds = [
    ...Object.values(recipesById).flatMap((r) => r.base_ingredients.map((i) => i.ingredient_id)),
    ...Object.values(componentsById).flatMap((c) => c.ingredient_list.map((i) => i.ingredient_id)),
  ];
  const ingredientsById = await findByIds<Ingredient>(COLLECTIONS.ingredients, ingredientIds);

  const { components, ingredients } = calculateFullIngredientRequirement(order.line_items, recipesById);
  return { componentRequirement: components, ingredientRequirement: ingredients, componentsById, ingredientsById };
}

// Fetches one item's batches oldest-first, FIFO-deducts qtyNeeded, persists the deductions
// (remaining_qty decrement + an InventoryMovement per deduction) — all inside the given
// transaction session — and returns whatever couldn't be covered (0 if fully fulfilled). Never
// throws on a shortfall: deductions just floor at zero and the caller reports it (ponytail:
// same over-drawing precedent as the inventory adjustment route from last phase).
async function fifoDeductAndRecord(
  itemType: 'semi_finished' | 'ingredient',
  itemId: string,
  qtyNeeded: number,
  orderId: string,
  session: ClientSession
): Promise<number> {
  if (qtyNeeded <= 0) return 0;
  const db = await getDb();
  const batchDocs = await db
    .collection(COLLECTIONS.inventoryBatches)
    .find({ item_type: itemType, item_id: itemId, remaining_qty: { $gt: 0 } }, { session })
    .sort({ received_date: 1 })
    .toArray();
  const sortedBatches: FifoBatch[] = batchDocs.map((b) => ({ batchId: String(b._id), remainingQty: b.remaining_qty as number }));
  const { deductions, unfulfilledRemainder } = deductFifo(sortedBatches, qtyNeeded);

  for (const deduction of deductions) {
    await db
      .collection(COLLECTIONS.inventoryBatches)
      .updateOne({ _id: toObjectId(deduction.batchId)! }, { $inc: { remaining_qty: -deduction.qtyDeducted } }, { session });
    await createOne(
      COLLECTIONS.inventoryMovements,
      {
        item_type: itemType,
        item_id: itemId,
        batch_id: deduction.batchId,
        quantity_delta: -deduction.qtyDeducted,
        reason: 'order_production',
        reference_id: orderId,
      },
      session
    );
  }
  return unfulfilledRemainder;
}

// The transactional half of production consumption: Phase 1 (semi-finished FIFO) -> convert any
// shortfall to raw-ingredient demand, merged into Phase 2's requirement -> Phase 2 (ingredient
// FIFO). Mirrors backend/app/services/production.py's consume_inventory_for_order.
async function consumeInventoryForOrder(
  orderId: string,
  requirement: ProductionRequirement,
  session: ClientSession
): Promise<{ shortfalls: ProductionShortfallItem[] }> {
  const { componentRequirement, componentsById, ingredientsById } = requirement;
  const ingredientRequirement = { ...requirement.ingredientRequirement };

  // Phase 1 — semi-finished components, FIFO.
  const componentShortfalls: Record<string, number> = {};
  for (const [componentId, qtyNeeded] of Object.entries(componentRequirement)) {
    const unfulfilled = await fifoDeductAndRecord('semi_finished', componentId, qtyNeeded, orderId, session);
    if (unfulfilled > 0) componentShortfalls[componentId] = unfulfilled;
  }

  // Convert each component shortfall into raw-ingredient demand and merge (sum, don't overwrite)
  // into the same ingredient requirement — an ingredient might already be needed directly too.
  for (const [componentId, shortfallQty] of Object.entries(componentShortfalls)) {
    const component = componentsById[componentId];
    if (!component) continue; // component deleted since order creation — nothing to convert against
    const ingredientLines: [string, number][] = component.ingredient_list.map((i) => [i.ingredient_id, i.qty_per_unit]);
    for (const [ingredientId, qty] of Object.entries(resolveComponentShortfallToIngredients(shortfallQty, ingredientLines))) {
      ingredientRequirement[ingredientId] = (ingredientRequirement[ingredientId] ?? 0) + qty;
    }
  }

  // Phase 2 — raw ingredients, FIFO.
  const shortfalls: ProductionShortfallItem[] = [];
  for (const [ingredientId, qtyNeeded] of Object.entries(ingredientRequirement)) {
    const unfulfilled = await fifoDeductAndRecord('ingredient', ingredientId, qtyNeeded, orderId, session);
    if (unfulfilled > 0) {
      const ingredient = ingredientsById[ingredientId];
      shortfalls.push({
        ingredient_id: ingredientId,
        name: ingredient?.name ?? ingredientId,
        unit: ingredient?.unit ?? '',
        shortfall_qty: unfulfilled,
      });
    }
  }
  return { shortfalls };
}

/**
 * No validation on newStatus beyond "order exists" — any string is accepted, no transition
 * graph (matches Order.status being a plain string). Production inventory consumption only
 * fires the FIRST time an order reaches "Production" (checked against status_history, so
 * flip-flopping the status back and forth never re-deducts).
 */
export async function transitionStatus(orderId: string, newStatus: string): Promise<{ order: Order; shortfall: ShortfallResult }> {
  const order = await getOne<Order>(COLLECTIONS.orders, orderId);
  if (!order) throw new HttpError(404, 'Order not found');

  const alreadyReachedProduction = order.status_history.some((change) => change.status === 'Production');
  const triggersProduction = newStatus === 'Production' && !alreadyReachedProduction;
  const newHistory = [...order.status_history, { status: newStatus, changed_at: new Date() }];

  if (!triggersProduction) {
    const updated = await updateOne<Order>(COLLECTIONS.orders, orderId, { status: newStatus, status_history: newHistory });
    return { order: updated!, shortfall: {} };
  }

  // First time reaching Production: status update + every FIFO batch/movement write happen in
  // ONE real transaction — Atlas supports them (confirmed last phase), so a mid-write failure
  // can't leave stock half-deducted with the order already marked Production, or vice versa.
  const requirement = await resolveProductionRequirement(order);

  const client = await getClient();
  const dbSession = client.startSession();
  try {
    return await dbSession.withTransaction<{ order: Order; shortfall: ShortfallResult }>(async () => {
      const updated = await updateOne<Order>(
        COLLECTIONS.orders,
        orderId,
        { status: newStatus, status_history: newHistory },
        dbSession
      );
      const shortfall = await consumeInventoryForOrder(orderId, requirement, dbSession);
      return { order: updated!, shortfall };
    });
  } finally {
    await dbSession.endSession();
  }
}

// ------------------------------- recordPayment -------------------------------

/** Returns {order, becameFullyPaidJustNow} so the route can trigger invoicing exactly once. */
export async function recordPayment(
  orderId: string,
  amount: number,
  method: string,
  notes: string
): Promise<{ order: Order; becameFullyPaidJustNow: boolean }> {
  const order = await getOne<Order>(COLLECTIONS.orders, orderId);
  if (!order) throw new HttpError(404, 'Order not found');

  const wasFullyPaid = order.payment_status === 'Fully Paid';

  await createOne(COLLECTIONS.payments, {
    order_id: order.id,
    customer_id: order.customer_id,
    amount,
    payment_date: new Date(),
    method,
    notes,
  });

  // Recomputed as a SUM of all payments every time (never incremented) so it can't drift.
  const db = await getDb();
  const payments = await db.collection(COLLECTIONS.payments).find({ order_id: order.id }).toArray();
  const amountPaid = payments.reduce((sum, p) => sum + (p.amount as number), 0);
  const paymentStatus = determinePaymentStatus(order.selling_price, amountPaid);

  const updated = await updateOne<Order>(COLLECTIONS.orders, orderId, {
    amount_paid: amountPaid,
    payment_status: paymentStatus,
  });

  const becameFullyPaidJustNow = paymentStatus === 'Fully Paid' && !wasFullyPaid;
  return { order: updated!, becameFullyPaidJustNow };
}
