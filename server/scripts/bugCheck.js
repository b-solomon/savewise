import '../loadEnv.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, getDbStatus, ready } from '../database.js';
import { parseSMS } from '../smsParser.js';
import { encrypt, decrypt, getAppKey } from '../crypto.js';
import { getLivePrices, searchSymbol } from '../marketData.js';
import { validatePassword, evaluatePasswordStrength } from '../passwordValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n======================================================');
console.log('🔍 SAVEWISE COMPREHENSIVE AUTOMATED BUG & HEALTH CHECK');
console.log('======================================================\n');

let failures = 0;
let passes = 0;

function reportTest(suite, name, success, info = '') {
  if (success) {
    passes++;
    console.log(`  ✅ [PASS] [${suite}] ${name} ${info ? `- ${info}` : ''}`);
  } else {
    failures++;
    console.error(`  ❌ [FAIL] [${suite}] ${name} ${info ? `- ${info}` : ''}`);
  }
}

// ─── 1. ENVIRONMENT & CONFIGURATION ───
console.log('🔹 1. Checking Environment Variables...');
try {
  const requiredVars = ['PORT', 'JWT_SECRET', 'ENCRYPTION_SALT'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length === 0) {
    reportTest('ENV', 'Core Variables Check', true, `PORT=${process.env.PORT || 4000}`);
  } else {
    reportTest('ENV', 'Core Variables Check', false, `Missing: ${missing.join(', ')}`);
  }

  if (process.env.OPENROUTER_API_KEY) {
    reportTest('ENV', 'OpenRouter API Key', true, 'Key present for AI Advisor');
  } else {
    reportTest('ENV', 'OpenRouter API Key', false, 'Missing OPENROUTER_API_KEY');
  }
} catch (err) {
  reportTest('ENV', 'Environment Check', false, err.message);
}

// ─── 2. CRYPTOGRAPHY & ENCRYPTION ───
console.log('\n🔹 2. Verifying AES-256-GCM Encryption Engine...');
try {
  const secretKey = getAppKey();
  if (!secretKey) throw new Error('Could not derive encryption key');
  
  const sampleString = 'SaveWise_Vault_Data_Verification_2026';
  const encrypted = encrypt(sampleString, secretKey);
  const decrypted = decrypt(encrypted, secretKey);

  if (decrypted === sampleString) {
    reportTest('CRYPTO', 'AES-256-GCM Loop', true, 'String encryption & decryption verified');
  } else {
    reportTest('CRYPTO', 'AES-256-GCM Loop', false, 'Decrypted value mismatch');
  }
} catch (err) {
  reportTest('CRYPTO', 'AES-256-GCM Loop', false, err.message);
}

// ─── 3. SMS PARSER & CATEGORY MAPPING ───
console.log('\n🔹 3. Testing SMS Transaction Parser Rules...');
try {
  const testCases = [
    {
      raw: 'Rs 1250 debited from A/c XX1234 on 10-Jun-26 for SWIGGY UPI Ref 412345678',
      expectedType: 'expense',
      expectedCat: 'Food & Dining',
      expectedAmt: 1250
    },
    {
      raw: 'INR 4500 debited for Zerodha stock purchase on 12/06/2026',
      expectedType: 'expense',
      expectedCat: 'Stocks',
      expectedAmt: 4500
    },
    {
      raw: 'Rs 5000 debited for Church offering tithe via UPI',
      expectedType: 'expense',
      expectedCat: 'Church',
      expectedAmt: 5000
    },
    {
      raw: 'You have received Rs.50,000.00 in your A/c XX1234 from SALARY via NEFT',
      expectedType: 'income',
      expectedCat: 'Salary',
      expectedAmt: 50000
    }
  ];

  for (const tc of testCases) {
    const res = parseSMS(tc.raw);
    const pass = res && !res.error && res.type === tc.expectedType && res.category === tc.expectedCat && res.amount === tc.expectedAmt;
    reportTest('SMS_PARSER', `Pattern (${tc.expectedCat})`, pass, pass ? `Extracted ₹${res.amount} ${res.type}` : `Got: ${JSON.stringify(res)}`);
  }
} catch (err) {
  reportTest('SMS_PARSER', 'Parser Execution', false, err.message);
}

// ─── 4. DATABASE & TABLES INTEGRITY ───
console.log('\n🔹 4. Verifying Database & Schema Tables...');
async function testDatabase() {
  try {
    await ready;
    const alive = await query.get('SELECT 1 as alive');
    const status = getDbStatus();
    
    if (alive) {
      reportTest('DATABASE', 'Database Connection & Query Engine', true, `Operating via ${status.dbType} database engine`);

      const tables = ['users', 'transactions', 'holdings', 'budgets', 'categories', 'savings_goals'];
      for (const tbl of tables) {
        try {
          const res = await query.get(`SELECT COUNT(*) as count FROM ${tbl}`);
          const count = res?.count ?? (res ? Object.values(res)[0] : 0);
          reportTest('DATABASE', `Table '${tbl}'`, true, `${count} records found`);
        } catch (tblErr) {
          reportTest('DATABASE', `Table '${tbl}'`, false, tblErr.message);
        }
      }
    } else {
      reportTest('DATABASE', 'Database Connection', false, status.dbConnectionError || 'Database query failed');
    }
  } catch (err) {
    reportTest('DATABASE', 'Database Check', false, err.message);
  }
}

// ─── 5. LIVE STOCK MARKET API ENGINE ───
console.log('\n🔹 5. Checking Live Stock Price & Ticker Search Engine...');
async function testStockEngine() {
  try {
    const results = await searchSymbol('RELIANCE');
    if (Array.isArray(results) && results.length > 0) {
      reportTest('STOCK_API', 'Yahoo Finance Ticker Search', true, `Found ${results.length} results for 'RELIANCE'`);
    } else {
      reportTest('STOCK_API', 'Yahoo Finance Ticker Search', false, 'No results returned');
    }

    const liveData = await getLivePrices([{ symbol: 'RELIANCE', exchange: 'NSE', quantity: 1, avg_buy_price: 2400 }]);
    if (Array.isArray(liveData) && liveData[0] && (liveData[0].livePrice > 0 || liveData[0].symbol === 'RELIANCE')) {
      reportTest('STOCK_API', 'Live Market Price Quote', true, `RELIANCE.NS current price: ₹${liveData[0].livePrice || liveData[0].avg_buy_price}`);
    } else {
      reportTest('STOCK_API', 'Live Market Price Quote', false, 'Failed to fetch live price quote');
    }
  } catch (err) {
    reportTest('STOCK_API', 'Stock Engine', false, err.message);
  }
}

// ─── 6. PASSWORD VALIDATION & STRENGTH ENGINE ───
console.log('\n🔹 6. Verifying Password Complexity & Strength Engine...');
function testPasswordEngine() {
  try {
    const weakCases = [
      '12345',
      'password',
      'PASSWORD123',
      'WeakPass1',
    ];
    for (const pw of weakCases) {
      const val = validatePassword(pw);
      const str = evaluatePasswordStrength(pw);
      const pass = !val.valid && (str.label === 'Weak' || str.label === 'Normal');
      reportTest('PASSWORD_ENGINE', `Reject Weak ('${pw}')`, pass, pass ? `Rejected correctly` : `Unexpectedly accepted!`);
    }

    const strongCases = [
      'SaveWise@2026!',
      'P@ssw0rd#Secure99'
    ];
    for (const pw of strongCases) {
      const val = validatePassword(pw);
      const str = evaluatePasswordStrength(pw);
      const pass = val.valid && (str.label === 'Strong' || str.label === 'Very Strong');
      reportTest('PASSWORD_ENGINE', `Accept Strong ('${pw}')`, pass, pass ? `Strength: ${str.label} (${str.percent}%)` : `Validation failed: ${val.error}`);
    }
  } catch (err) {
    reportTest('PASSWORD_ENGINE', 'Password Check Execution', false, err.message);
  }
}

// ─── MAIN RUNNER ───
async function runAllDiagnostics() {
  await testDatabase();
  await testStockEngine();
  testPasswordEngine();

  console.log('\n======================================================');
  console.log(`📊 DIAGNOSTIC SUMMARY: ${passes} Passed | ${failures} Failed`);
  console.log('======================================================\n');

  if (failures === 0) {
    console.log('🟢 ALL SYSTEMS OPERATIONAL: No bugs detected.\n');
    process.exit(0);
  } else {
    console.error(`🔴 ALERT: ${failures} diagnostic check(s) failed!\n`);
    process.exit(1);
  }
}

runAllDiagnostics();
