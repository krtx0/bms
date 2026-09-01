import { z } from 'zod';
import { createRateLimiter } from '@/lib/rateLimit';
import { createOrder, HttpError, type OrderCreatePayload } from '@/lib/services/orderWorkflow';
import type { ImportantDate } from '@/types';

// The one unauthenticated write path into this app's database — see web/proxy.ts for the
// matching /order-form page exception. Everything below exists to keep that safe:
//   - honeypot: a hidden field real visitors never fill in; bots often do
//   - rate limiting: own limiter instance, separate from lib/auth.ts's login limiter
//   - zod validation: the one route in this app that actually needs it (every other route sits
//     behind requireAuth(), so an authenticated admin is trusted; this route is not)
//   - selling_price is always 0 here — an anonymous submitter never sets a price the app treats
//     as real. The order lands as Pending/source:'public_form' for an admin to price and confirm.
const limiter = createRateLimiter(5, 60 * 60 * 1000); // 5 submissions / hour / IP

const EVENT_TYPES = ['Birthday', 'Anniversary', 'Wedding', 'Corporate', 'Other'] as const;
const FULFILLMENT = ['Pickup', 'Delivery'] as const;
const TIME_SLOTS = ['Morning', 'Afternoon', 'Evening'] as const;
const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Bank Transfer'] as const;
const EGG_TYPES = ['Egg', 'Eggless'] as const;

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid date');
const optionalDate = z.union([isoDate, z.literal('')]).optional();

const publicOrderSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  whatsapp_number: z.string().trim().regex(/^\+?[0-9\s-]{10,15}$/, 'Enter a valid phone number'),
  email: z.string().trim().email().max(200),
  address: z.string().trim().max(500).optional().default(''),

  event_type: z.enum(EVENT_TYPES),
  event_date: isoDate,
  product_category: z.string().trim().max(80).optional().default(''),
  recipe_id: z.string().trim().min(1, 'Select a flavour'),
  egg_type: z.enum(EGG_TYPES),
  weight_kg: z.number().positive().max(50),
  quantity: z.number().int().min(1).max(50).default(1),

  fulfillment: z.enum(FULFILLMENT),
  time_slot: z.enum(TIME_SLOTS),
  payment_method: z.enum(PAYMENT_METHODS),
  advance_amount: z.number().min(0).max(500000).default(0),
  additional_notes: z.string().trim().max(1000).optional().default(''),

  partner_birthday: optionalDate,
  anniversary: optionalDate,
  childrens_birthdays: z.string().trim().max(500).optional().default(''),
  other_family_occasions: z.string().trim().max(500).optional().default(''),
  recurring_events: z.string().trim().max(500).optional().default(''),
  special_reminders: z.string().trim().max(1000).optional().default(''),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ detail: 'Invalid request body' }, { status: 400 });

  if (typeof body.website === 'string' && body.website.length > 0) {
    // Honeypot tripped — fake success, never touches the DB or the rate limiter, so a bot can't
    // tell its submission was rejected.
    return Response.json({ id: 'ok', order_number: 'OK' }, { status: 201 });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limiter.isLimited(ip)) {
    return Response.json({ detail: 'Too many submissions — please try again later.' }, { status: 429 });
  }
  limiter.record(ip); // counts every non-honeypot attempt, valid or not — a bad-payload flood still throttles

  const parsed = publicOrderSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ detail: parsed.error.issues[0]?.message ?? 'Invalid submission' }, { status: 400 });
  }
  const d = parsed.data;

  const important_dates: ImportantDate[] = [
    ...(d.partner_birthday ? [{ label: "Partner's birthday", date: d.partner_birthday }] : []),
    ...(d.anniversary ? [{ label: 'Anniversary', date: d.anniversary }] : []),
  ];
  const familyNotes = [
    d.childrens_birthdays && `Children's birthdays: ${d.childrens_birthdays}`,
    d.other_family_occasions && `Other family occasions: ${d.other_family_occasions}`,
    d.recurring_events && `Recurring events: ${d.recurring_events}`,
    d.special_reminders && `Special reminders: ${d.special_reminders}`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
  const orderNotes = [
    '[Public order form submission]',
    `Event type: ${d.event_type}`,
    d.product_category && `Product category: ${d.product_category}`,
    `Fulfillment: ${d.fulfillment}`,
    `Time slot: ${d.time_slot}`,
    `Preferred payment: ${d.payment_method}`,
    d.advance_amount > 0 && `Stated advance: ₹${d.advance_amount} (not received — confirm before recording a payment)`,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  const payload: OrderCreatePayload = {
    customer: {
      name: d.full_name,
      phone: d.whatsapp_number,
      email: d.email,
      address: d.address,
      notes: familyNotes || undefined,
      important_dates,
    },
    event_date: d.event_date,
    delivery_date: d.event_date,
    line_items: [
      {
        recipe_id: d.recipe_id,
        weight: d.weight_kg,
        quantity: d.quantity,
        customizations: [`Type: ${d.egg_type}`, d.additional_notes && `Notes: ${d.additional_notes}`]
          .filter((part): part is string => Boolean(part))
          .join(' | '),
        selling_price: 0,
      },
    ],
    notes: orderNotes,
    source: 'public_form',
  };

  try {
    const order = await createOrder(payload);
    return Response.json({ id: order.id, order_number: order.order_number }, { status: 201 });
  } catch (err) {
    if (err instanceof HttpError) return Response.json({ detail: err.message }, { status: err.status });
    throw err;
  }
}
