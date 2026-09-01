// Invoice generation for Fully-Paid orders, plus PDF rendering. Ported from
// backend/app/services/invoicing.py — but the old xhtml2pdf (raw HTML -> PDF) API doesn't exist
// here; @react-pdf/renderer instead defines the document as React components (Document/Page/
// View/Text), so this needs JSX (.tsx, not .ts, despite every other service file being plain
// .ts). `server-only` guards against Buffer/renderToBuffer ever finding their way into a client
// bundle if something later imports from this module for its types.
import 'server-only';

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { createOne } from '@/lib/crud';
import { COLLECTIONS, getDb } from '@/lib/db';
import { nextInvoiceNumber } from '@/lib/services/numbering';
import { toApiDoc } from '@/lib/serialize';
import type { Customer, Invoice, Order } from '@/types';

/**
 * Creates an Invoice for a Fully-Paid order. Idempotent: if one already exists for this
 * order_id, returns it instead of creating a duplicate (a payment-recompute edge case could
 * theoretically re-trigger the Fully-Paid transition).
 */
export async function generateInvoiceForOrder(order: Order): Promise<Invoice> {
  const db = await getDb();
  const existing = await db.collection(COLLECTIONS.invoices).findOne({ order_id: order.id });
  if (existing) return toApiDoc(existing) as unknown as Invoice;

  const issuedDate = new Date();
  const invoiceNumber = await nextInvoiceNumber(issuedDate);
  return createOne<Invoice>(COLLECTIONS.invoices, {
    invoice_number: invoiceNumber,
    order_id: order.id,
    customer_id: order.customer_id,
    issued_date: issuedDate,
    amount: order.selling_price,
  });
}

// ------------------------------- PDF -------------------------------

const cell = { borderRight: '1pt solid #999999', borderBottom: '1pt solid #999999', padding: 6 };
const right = { textAlign: 'right' } as const;

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1a1a' },
  h1: { fontSize: 20, marginBottom: 14 },
  meta: { fontSize: 11, marginBottom: 3 },
  billTo: { marginTop: 16, marginBottom: 16 },
  table: { borderTop: '1pt solid #999999', borderLeft: '1pt solid #999999' },
  row: { flexDirection: 'row' },
  headerRow: { flexDirection: 'row', backgroundColor: '#f2f2f2', fontWeight: 'bold' },
  colFlavour: { ...cell, width: '25%' },
  colWeight: { ...cell, width: '13%' },
  colQty: { ...cell, width: '10%', ...right },
  colCustom: { ...cell, width: '22%' },
  colRate: { ...cell, width: '15%', ...right },
  colAmount: { ...cell, width: '15%', ...right },
  totalLabel: { ...cell, width: '85%', ...right, fontWeight: 'bold' },
  totalAmount: { ...cell, width: '15%', ...right, fontWeight: 'bold' },
});

function InvoiceDocument({ order, customer, invoice }: { order: Order; customer: Customer; invoice: Invoice }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Mélange Patisserie</Text>
        <Text style={styles.meta}>Invoice Number: {invoice.invoice_number}</Text>
        <Text style={styles.meta}>Issued Date: {new Date(invoice.issued_date).toLocaleDateString()}</Text>
        <Text style={styles.meta}>Order Number: {order.order_number}</Text>

        <View style={styles.billTo}>
          <Text style={styles.meta}>Billed To:</Text>
          <Text style={styles.meta}>{customer.name}</Text>
          {customer.phone ? <Text style={styles.meta}>{customer.phone}</Text> : null}
          {customer.email ? <Text style={styles.meta}>{customer.email}</Text> : null}
        </View>

        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={styles.colFlavour}>Flavour</Text>
            <Text style={styles.colWeight}>Weight</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colCustom}>Customizations</Text>
            <Text style={styles.colRate}>Rate</Text>
            <Text style={styles.colAmount}>Amount</Text>
          </View>
          {order.line_items.map((li, i) => (
            <View style={styles.row} key={i}>
              <Text style={styles.colFlavour}>{li.flavour_code}</Text>
              <Text style={styles.colWeight}>{li.weight}</Text>
              <Text style={styles.colQty}>{li.quantity}</Text>
              <Text style={styles.colCustom}>{li.customizations}</Text>
              <Text style={styles.colRate}>{li.selling_price.toFixed(2)}</Text>
              <Text style={styles.colAmount}>{li.line_total_amount.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalAmount}>{invoice.amount.toFixed(2)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/** Renders the invoice to PDF bytes. A Route Handler can return this Buffer directly as a Response body. */
export async function renderInvoicePdf(order: Order, customer: Customer, invoice: Invoice): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument order={order} customer={customer} invoice={invoice} />);
}
