// Manually set (or create) the admin login, hashing the password the same way the app does.
// Run against local dev:      node --env-file=.env.local scripts/set-admin-password.mjs <email> <password>
// Run against production:     node --env-file=.env.production.local scripts/set-admin-password.mjs <email> <password>
//   (put the live MONGODB_URI/MONGODB_DB_NAME in that file first — never commit it)
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node --env-file=.env.local scripts/set-admin-password.mjs <email> <password>');
  process.exit(1);
}

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.MONGODB_DB_NAME || 'melange_bms');

const normalizedEmail = email.trim().toLowerCase();
const hashed_password = await bcrypt.hash(password, 10);

await db.collection('users').updateOne(
  { email: normalizedEmail },
  {
    $set: { email: normalizedEmail, hashed_password, role: 'admin' },
    $setOnInsert: { full_name: 'Business Owner', created_at: new Date() },
  },
  { upsert: true }
);

console.log(`Admin credentials set for ${normalizedEmail}`);
await client.close();
