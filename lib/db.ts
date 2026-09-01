import { MongoClient, type Db } from 'mongodb';

// MONGODB_URI is the plain (non-SRV) Atlas connection string, listing all three shard hosts
// explicitly. This machine's configured DNS resolver refuses SRV/TXT queries outright (confirmed
// via a standalone dns.resolveSrv() test — ECONNREFUSED), which a mongodb+srv:// string needs to
// discover the replica set. dns.setServers() fixes that in a plain Node script but turned out
// not to affect the resolver Next.js's dev runtime actually uses for route handlers — so instead
// of depending on process-global DNS state, the connection string itself just avoids SRV/TXT
// lookups entirely (see .env.local.example for how these hosts/replicaSet were obtained).
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'melange_bms';

if (!uri) {
  throw new Error('MONGODB_URI is not set (check .env.local)');
}

// Next.js dev-mode hot-reload re-evaluates this module often; cache the client on the global
// object so we don't open a fresh MongoClient (and connection pool) on every reload.
const globalForMongo = global as unknown as { _mongoClientPromise?: Promise<MongoClient> };

const clientPromise: Promise<MongoClient> =
  globalForMongo._mongoClientPromise ?? new MongoClient(uri).connect();

if (process.env.NODE_ENV !== 'production') {
  globalForMongo._mongoClientPromise = clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}

// Only needed to start a session for multi-document transactions (purchases, FIFO adjustment
// deduction) — getDb() alone doesn't expose the client. Confirmed this Atlas cluster supports
// transactions (it's a replica set) via a one-off manual check before this was added.
export async function getClient(): Promise<MongoClient> {
  return clientPromise;
}

// Collection name constants — one place to change if a collection is ever renamed.
export const COLLECTIONS = {
  users: 'users',
  customers: 'customers',
  ingredients: 'ingredients',
  packaging: 'packaging',
  suppliers: 'suppliers',
  components: 'components',
  recipes: 'recipes',
  inventoryBatches: 'inventory_batches',
  inventoryMovements: 'inventory_movements',
  purchases: 'purchases',
  orders: 'orders',
  payments: 'payments',
  invoices: 'invoices',
  expenses: 'expenses',
  settings: 'settings',
  notificationCompletions: 'notification_completions',
} as const;

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await db.collection(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true });
  await db.collection(COLLECTIONS.customers).createIndex({ phone: 1 });
  await db.collection(COLLECTIONS.customers).createIndex({ is_lead: 1 });
  await db.collection(COLLECTIONS.ingredients).createIndex({ name: 1 }, { unique: true });
  await db.collection(COLLECTIONS.packaging).createIndex({ name: 1 }, { unique: true });
  await db.collection(COLLECTIONS.suppliers).createIndex({ name: 1 });
  await db.collection(COLLECTIONS.components).createIndex({ name: 1 });
  await db.collection(COLLECTIONS.recipes).createIndex({ flavour_code: 1 }, { unique: true });
  await db
    .collection(COLLECTIONS.inventoryBatches)
    .createIndex({ item_type: 1, item_id: 1, received_date: 1 });
  await db
    .collection(COLLECTIONS.inventoryMovements)
    .createIndex({ item_type: 1, item_id: 1, created_at: 1 });
  await db.collection(COLLECTIONS.purchases).createIndex({ supplier_id: 1 });
  await db.collection(COLLECTIONS.purchases).createIndex({ purchase_date: 1 });
  await db.collection(COLLECTIONS.orders).createIndex({ order_number: 1 }, { unique: true });
  await db.collection(COLLECTIONS.orders).createIndex({ customer_id: 1 });
  await db.collection(COLLECTIONS.orders).createIndex({ status: 1 });
  await db.collection(COLLECTIONS.orders).createIndex({ delivery_date: 1 });
  await db.collection(COLLECTIONS.payments).createIndex({ order_id: 1 });
  await db.collection(COLLECTIONS.payments).createIndex({ customer_id: 1, payment_date: 1 });
  await db.collection(COLLECTIONS.invoices).createIndex({ invoice_number: 1 }, { unique: true });
  await db.collection(COLLECTIONS.invoices).createIndex({ order_id: 1 });
  await db.collection(COLLECTIONS.expenses).createIndex({ expense_date: 1 });
  await db.collection(COLLECTIONS.notificationCompletions).createIndex({ key: 1 }, { unique: true });
}
