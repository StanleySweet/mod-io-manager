import { getDB, closeDB } from '../database/db.js';
import { hashPassword } from '../utils/password.js';
import crypto from 'crypto';

async function createApiKey() {
  const [, , name, role = 'queue_worker'] = process.argv;
  if (!name) {
    console.error('Usage: npx tsx src/scripts/create-api-key.ts <name> [role]');
    process.exit(1);
  }
  const plainKey = `mk_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = await hashPassword(plainKey);
  const db = getDB();
  await db('api_keys').insert({ name, key_hash: keyHash, role });
  console.log(`API Key (save now, shown once): ${plainKey}`);
  await closeDB();
}

createApiKey().catch(e => {
  console.error(e);
  process.exit(1);
});
