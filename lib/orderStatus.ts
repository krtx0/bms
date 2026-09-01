import type { OrderPriority, OrderStatus, PaymentStatus } from '@/types';

// Color mapping shared by the Orders page (list + detail) and Customers page (order history).
// Ported verbatim from frontend/src/lib/orderStatus.ts.
const STATUS_PILL: Record<OrderStatus, string> = {
  Pending: 'pill-tan',
  Confirmed: 'pill-blue',
  Production: 'pill-tan',
  Ready: 'pill-blue',
  Delivered: 'pill-green',
  Cancelled: 'pill-red',
};

const PAYMENT_PILL: Record<PaymentStatus, string> = {
  Pending: 'pill-red',
  'Partially Paid': 'pill-tan',
  'Fully Paid': 'pill-green',
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  Pending: 'UNPAID',
  'Partially Paid': 'PARTIAL',
  'Fully Paid': 'PAID',
};

const PRIORITY_PILL: Record<OrderPriority, string> = {
  low: 'pill-green',
  medium: 'pill-tan',
  high: 'pill-red',
};

export function statusPillClass(status: string): string {
  return STATUS_PILL[status as OrderStatus] ?? 'pill-tan';
}

export function paymentPillClass(status: string): string {
  return PAYMENT_PILL[status as PaymentStatus] ?? 'pill-tan';
}

export function paymentLabel(status: string): string {
  return PAYMENT_LABEL[status as PaymentStatus] ?? status;
}

export function priorityPillClass(priority: string): string {
  return PRIORITY_PILL[priority as OrderPriority] ?? 'pill-tan';
}
