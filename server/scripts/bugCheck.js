import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { parseSMS } from '../smsParser.js';
import { encrypt, decrypt, getAppKey } from '../crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables manually from potential locations
const envPaths = [
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env')
];

let envLoaded = false;
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`🟢 Loaded environment variables from: ${p}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  dotenv.config();
  console.log('🟡 Running default dotenv configuration.');
}

console.log('\n=== SAVEWISE AUTOMATED DIAGNOSTICS ===');

let failures = 0;

function reportTest(name, success, info = '') {
  if (success) {
    console.log(`✅ [PASS] ${name} ${info ? `- ${info}` : ''}`);
  } else {
    console.error(`❌ [FAIL] ${name} ${info ? `- ${info}` : ''}`);
    failures++;
  }
}

// 1. Environment Verification
try {
  const requiredVars = ['PORT', 'JWT_SECRET', 'DATABASE_URL', 'ENCRYPTION_SALT'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length === 0) {
    reportTest('Environment Variables', true, 'All required variables are present');
  } else {
    reportTest('Environment Variables', false, `Missing: ${missing.join(', ')}`);
  }
} catch (err) {
  reportTest('Environment Variables', false, err.message);
}

// 2. Cryptography Validation
try {
  const secretKey = getAppKey();
  if (!secretKey) {
    throw new Error('Could not derive encryption key. Check ENCRYPTION_SALT.');
  }
  const testText = 'SaveWise_Vault_Check_2026';
  const encrypted = encrypt(testText, secretKey);
  const decrypted = decrypt(encrypted, secretKey);
  if (decrypted === testText) {
    reportTest('Crypto & Encryption', true, 'Encryption and decryption loop matched');
  } else {
    reportTest('Crypto & Encryption', false, 'Decrypted value mismatch');
  }
} catch (err) {
  reportTest('Crypto & Encryption', false, err.message);
}

// 3. SMS Parser Validation
try {
  const testSms = 'Dear Customer, Rs 1250 has been debited from your account XXXX1234 to VPA merchant@upi on 10-Jun-2026';
  const parsed = parseSMS(testSms);
  
  if (parsed && !parsed.error && parsed.amount === 1250 && parsed.type === 'expense') {
    reportTest('SMS Transaction Parser', true, 'Sample debit alert parsed correctly');
  } else {
    reportTest('SMS Transaction Parser', false, `Invalid parse result: ${JSON.stringify(parsed)}`);
  }
} catch (err) {
  reportTest('SMS Transaction Parser', false, err.message);
}

// 4. Database Connection Verification (Supabase PG)
async function verifyDatabase() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    reportTest('Database Connection', false, 'DATABASE_URL is not set');
    return;
  }
  
  console.log('Testing Supabase PostgreSQL connection...');
  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  
  const startTime = Date.now();
  try {
    const res = await pool.query('SELECT NOW()');
    const latency = Date.now() - startTime;
    reportTest('Database Connection', true, `Connected successfully! Latency: ${latency}ms`);
  } catch (err) {
    reportTest('Database Connection', false, `Failed to query PostgreSQL: ${err.message}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  await verifyDatabase();
  console.log('\n======================================');
  if (failures === 0) {
    console.log('🟢 DIAGNOSTICS COMPLETED: No bugs or connection issues found.');
    process.exit(0);
  } else {
    console.error(`🔴 DIAGNOSTICS COMPLETED: ${failures} issue(s) detected!`);
    process.exit(1);
  }
}

main();
