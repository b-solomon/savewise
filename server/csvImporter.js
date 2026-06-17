// CSV Bank Statement Importer
// Supports: HDFC, SBI, ICICI, Axis, Kotak, PNB, BOB, Yes Bank CSV exports

import { parse } from 'csv-parse/sync';

// Known column mappings for Indian banks
const BANK_FORMATS = [
  { // HDFC Bank
    detect: (headers) => headers.some(h => /narration/i.test(h)),
    map: { date: /date/i, description: /narration|description/i, debit: /debit|withdrawal/i, credit: /credit|deposit/i, balance: /balance/i }
  },
  { // SBI
    detect: (headers) => headers.some(h => /txn\s*date/i.test(h)),
    map: { date: /txn\s*date|value\s*date/i, description: /description|ref|particulars/i, debit: /debit/i, credit: /credit/i, balance: /balance/i }
  },
  { // ICICI / Axis / Kotak / Generic
    detect: () => true,
    map: { date: /date|txn|value/i, description: /description|narration|particular|remark|detail/i, debit: /debit|dr|withdrawal|spent/i, credit: /credit|cr|deposit|received/i, balance: /balance/i }
  }
];

function findColumn(headers, pattern) {
  return headers.findIndex(h => pattern.test(h.trim()));
}

function parseCSVDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const d = dateStr.trim();
  // DD/MM/YYYY or DD-MM-YYYY
  const m1 = d.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m1) { let [,day,mon,yr] = m1; if (yr.length === 2) yr = '20'+yr; return `${yr}-${mon.padStart(2,'0')}-${day.padStart(2,'0')}`; }
  // Try native parse
  const parsed = new Date(d);
  if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function parseNumber(val) {
  if (!val) return 0;
  const clean = String(val).replace(/[,\s"]/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : Math.abs(num);
}

// Simple category detection from description
const CAT_MAP = [
  [/swiggy|zomato|food|restaurant|cafe|dominos|pizza|kfc|mcdonald/i, 'Food & Dining'],
  [/uber|ola|rapido|petrol|fuel|metro|irctc|toll|fastag/i, 'Transport'],
  [/amazon|flipkart|myntra|shopping|ajio|nykaa/i, 'Shopping'],
  [/rent|society|maintenance/i, 'Rent'],
  [/airtel|jio|vodafone|electricity|power|gas|water|broadband|recharge|bill/i, 'Bills & Utilities'],
  [/netflix|hotstar|spotify|movie|pvr|inox|prime/i, 'Entertainment'],
  [/hospital|pharma|medical|doctor|apollo|1mg/i, 'Health'],
  [/bigbasket|blinkit|zepto|dmart|grocer/i, 'Groceries'],
  [/emi|loan|ecs/i, 'EMI & Loans'],
  [/insurance|lic/i, 'Insurance'],
  [/salary|payroll/i, 'Salary'],
  [/interest|dividend|mf|mutual/i, 'Investment'],
  [/refund|reversal|cashback/i, 'Refund'],
];

function categorize(desc, type) {
  for (const [re, cat] of CAT_MAP) { if (re.test(desc)) return cat; }
  return type === 'income' ? 'Other Income' : 'Other';
}

export function importCSV(csvContent) {
  let records;
  try {
    records = parse(csvContent, { columns: false, skip_empty_lines: true, relax_column_count: true, bom: true });
  } catch (e) {
    return { error: `CSV parse error: ${e.message}`, results: [] };
  }

  if (records.length < 1) return { error: 'CSV has no data', results: [] };

  // Find the header row index by scanning the first 15 rows
  let headerIndex = 0;
  for (let i = 0; i < Math.min(15, records.length); i++) {
    const row = records[i].map(c => String(c).toLowerCase().trim());
    const hasDate = row.some(c => /date|txn/i.test(c));
    const hasDesc = row.some(c => /description|narration|particular|remark|detail/i.test(c));
    if (hasDate && hasDesc) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex >= records.length) {
    headerIndex = 0;
  }

  const headers = records[headerIndex].map(h => String(h).trim());
  const dataRows = records.slice(headerIndex + 1);

  // Find matching bank format
  let format = BANK_FORMATS.find(f => f.detect(headers));
  if (!format) format = BANK_FORMATS[BANK_FORMATS.length - 1]; // generic fallback

  const dateCol = findColumn(headers, format.map.date);
  const descCol = findColumn(headers, format.map.description);
  const debitCol = findColumn(headers, format.map.debit);
  const creditCol = findColumn(headers, format.map.credit);

  if (dateCol < 0 || descCol < 0) {
    return { error: `Could not detect date/description columns in headers: ${headers.join(', ')}`, results: [] };
  }

  const results = [];
  for (const row of dataRows) {
    if (!row[dateCol] && !row[descCol]) continue; // skip empty rows

    const debit = debitCol >= 0 ? parseNumber(row[debitCol]) : 0;
    const credit = creditCol >= 0 ? parseNumber(row[creditCol]) : 0;

    if (debit === 0 && credit === 0) continue; // skip zero-amount rows

    const type = credit > 0 ? 'income' : 'expense';
    const amount = credit > 0 ? credit : debit;
    const desc = String(row[descCol] || '').trim();
    const category = categorize(desc, type);

    results.push({
      type,
      amount,
      category,
      description: desc,
      merchant: desc.slice(0, 40),
      date: parseCSVDate(row[dateCol]),
      paymentMethod: 'Net Banking',
      source: 'csv'
    });
  }

  return { total: results.length, results };
}
