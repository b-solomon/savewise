// SaveWise Security Migration Script
// Encrypts legacy unencrypted financial fields (amount, merchant, raw_sms)
// using the dedicated AES-256-GCM master key.

import '../loadEnv.js';
import { query, ready } from '../database.js';
import { getAppKey, encrypt, decrypt } from '../crypto.js';

async function runMigration() {
  console.log('\n========================================================');
  console.log('🛡️  SAVEWISE SECURE FINANCIAL DATA ENCRYPTION MIGRATION');
  console.log('========================================================\n');

  try {
    await ready;
    const key = getAppKey();
    if (!key) throw new Error('Could not derive encryption master key. Check ENCRYPTION_MASTER_KEY.');

    console.log('Fetching existing transactions...');
    const txns = await query.all('SELECT id, user_id, amount, amount_enc, merchant, merchant_enc, raw_sms FROM transactions');
    console.log(`Found ${txns.length} transactions to inspect.`);

    let migrated = 0;
    for (const t of txns) {
      let needsUpdate = false;
      let newAmountEnc = t.amount_enc;
      let newMerchantEnc = t.merchant_enc;
      let newRawEnc = t.raw_sms;

      if (!newAmountEnc || newAmountEnc.length < 10) {
        newAmountEnc = encrypt(String(t.amount || 0), key);
        needsUpdate = true;
      }

      if ((!newMerchantEnc || newMerchantEnc.length < 10) && t.merchant) {
        newMerchantEnc = encrypt(t.merchant, key);
        needsUpdate = true;
      }

      if (t.raw_sms && !t.raw_sms.startsWith('ey') && t.raw_sms.length < 50) {
        // Encrypt raw sms if still plaintext
        newRawEnc = encrypt(t.raw_sms, key);
        needsUpdate = true;
      }

      if (needsUpdate) {
        await query.run(
          'UPDATE transactions SET amount_enc = ?, merchant_enc = ?, raw_sms = ? WHERE id = ?',
          [newAmountEnc, newMerchantEnc, newRawEnc, t.id]
        );
        migrated++;
      }
    }

    console.log(`\n✅ Migration complete: ${migrated} records securely encrypted at rest with AES-256-GCM.`);
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
