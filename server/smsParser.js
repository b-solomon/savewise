// Indian Bank SMS Parser — Handles 30+ SMS formats from major Indian banks
// Supports: SBI, HDFC, ICICI, Axis, Kotak, PNB, BOB, IndusInd, Yes Bank, and UPI apps

const AMOUNT_PATTERNS = [
  /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.\d{1,2})?)/i,
  /(?:Amt|Amount)\s*(?:Debited|Credited|Sent|Received)?\s*:?\s*(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
  /(?:debited|credited|spent|received|paid|withdrawn|transferred|sent)\s+(?:Rs\.?|INR|₹)?\s*([0-9,]+(?:\.\d{1,2})?)/i,
  /([0-9,]+(?:\.\d{1,2})?)\s*(?:has been|is)\s*(?:debited|credited)/i,
];

const DATE_PATTERNS = [
  /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
  /(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*[\s,]*\d{2,4})/i,
  /(\d{1,2}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\d{2,4})/i,
  /on\s+(\d{1,2}[-\/]\w+[-\/]?\d{0,4})/i,
  /dated?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
];

const MONTHS = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };

const EXPENSE_KW = /debit|spent|paid|withdrawn|purchase|txn\s+to|sent\s+to|transfer(?:red)?\s+to|payment|deducted/i;
const INCOME_KW = /credit|received|deposit|refund|cashback|salary|neft\s+cr|imps\s+cr|reversed|added/i;

const PAYMENT_METHODS = [
  [/\bUPI\b/i, 'UPI'], [/\bNEFT\b/i, 'NEFT'], [/\bIMPS\b/i, 'IMPS'], [/\bRTGS\b/i, 'RTGS'],
  [/credit\s*card/i, 'Credit Card'], [/debit\s*card/i, 'Debit Card'],
  [/\bATM\b/i, 'ATM'], [/net\s*banking/i, 'Net Banking'],
  [/\bECS\b/i, 'ECS'], [/\bACH\b/i, 'ACH'], [/\bEMI\b/i, 'EMI'],
  [/auto.?debit/i, 'Auto Debit'], [/standing\s*instruction/i, 'Standing Instruction'],
];

const MERCHANT_PATTERNS = [
  /(?:at|to|for|@)\s+([A-Za-z0-9][\w\s.&'"-]{1,45}?)(?:\s+on|\s+UPI|\s+Ref|\s*$|\s+via|\.\s|,)/i,
  /(?:to\s+VPA\s+)(\S+?)(?:\s|$)/i,
  /(?:VPA\s*)(\S+@\S+)/i,
  /Info:\s*(.+?)(?:\s*$)/i,
  /(?:at\s+)(.+?)(?:\s+Card|\s+on|\s*$)/i,
];

const CATEGORY_MAP = [
  { kw: /swiggy|zomato|uber\s*eats|dominos|pizza|mcdonald|kfc|restaurant|food|dining|cafe|starbucks|chai|biryani|magicpin|eatfit|dineout|box8/i, cat: 'Food & Dining' },
  { kw: /uber|ola|rapido|metro|irctc|railway|petrol|fuel|hp\s*fuel|iocl|bpcl|shell|parking|toll|fastag|redbus|makemytrip|cleartrip|vistara|indigo|spicejet|air\s*india/i, cat: 'Transport' },
  { kw: /amazon|flipkart|myntra|ajio|nykaa|meesho|tatacliq|croma|reliance\s*digital|snapdeal|firstcry|lenskart|pepperfry|urban\s*ladder/i, cat: 'Shopping' },
  { kw: /rent|landlord|society|maintenance|housing|nobroker/i, cat: 'Rent' },
  { kw: /airtel|jio|vodafone|vi\s|bsnl|electricity|power|gas|water|broadband|wifi|bill|recharge|dth|tata\s*play|dish\s*tv|act\s*fibernet|hathway/i, cat: 'Bills & Utilities' },
  { kw: /netflix|hotstar|prime|spotify|youtube|disney|zee5|sonyliv|movie|theatre|pvr|inox|gaming|dream11|mpl|bookmyshow|apple\s*music/i, cat: 'Entertainment' },
  { kw: /apollo|pharma|medplus|hospital|clinic|doctor|medical|lab|diagnostic|1mg|netmeds|practo|dentist|lenskart/i, cat: 'Health' },
  { kw: /udemy|coursera|school|college|tuition|book|unacademy|byju|education|upgrad|simplilearn|vedantu/i, cat: 'Education' },
  { kw: /bigbasket|blinkit|zepto|instamart|jiomart|grofers|dmart|more\s*retail|nature|basket|fresh/i, cat: 'Groceries' },
  { kw: /lic|insurance|hdfc\s*life|icici\s*pru|max\s*life|star\s*health|bajaj\s*allianz|sbi\s*life/i, cat: 'Insurance' },
  { kw: /emi|loan|ecs.*emi|bajaj\s*finserv|home\s*credit|zestmoney/i, cat: 'EMI & Loans' },
  { kw: /salary|payroll/i, cat: 'Salary' },
  { kw: /freelance|upwork|fiverr|client\s*payment|toptal/i, cat: 'Freelance' },
  { kw: /dividend|interest|mutual\s*fund|stock|trading|zerodha|groww|upstox|angel|mf\s*redemption/i, cat: 'Investment' },
  { kw: /refund|cashback|reversal/i, cat: 'Refund' },
];

function parseAmount(text) {
  for (const pat of AMOUNT_PATTERNS) {
    const m = text.match(pat);
    if (m) { const v = parseFloat(m[1].replace(/,/g, '')); if (v > 0) return v; }
  }
  return null;
}

function parseDate(text) {
  const currentYear = new Date().getFullYear();
  for (const pat of DATE_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      const raw = m[1].trim();
      // Try dd/mm/yyyy or dd/mm/yy or dd/mm
      const dd = raw.match(/^(\d{1,2})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?$/);
      if (dd) {
        let [, d, mo, y] = dd;
        if (!y) y = String(currentYear);
        else if (y.length === 2) y = '20' + y;
        return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      // Try dd-mon-yyyy or dd-mon-yy or dd-mon
      const mm = raw.match(/^(\d{1,2})\s*[-\s]?\s*([A-Za-z]{3})\w*(?:\s*[-\s,]*\s*(\d{2,4}))?$/i);
      if (mm) {
        let [, d, mon, y] = mm;
        if (!y) y = String(currentYear);
        else if (y.length === 2) y = '20' + y;
        const mi = MONTHS[mon.toLowerCase().slice(0, 3)];
        if (mi !== undefined) return `${y}-${String(mi + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
  }

  // Fallback to generic regex matching anywhere in the text if patterns didn't parse clean
  const genericDD = text.match(/\b(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})\b/);
  if (genericDD) {
    let [, d, mo, y] = genericDD;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const genericMM = text.match(/\b(\d{1,2})\s*[-\s]?\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*(?:\s*[-\s,]*\s*(\d{2,4}))?\b/i);
  if (genericMM) {
    let [, d, mon, y] = genericMM;
    if (!y) y = String(currentYear);
    else if (y.length === 2) y = '20' + y;
    const mi = MONTHS[mon.toLowerCase().slice(0, 3)];
    if (mi !== undefined) return `${y}-${String(mi + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return new Date().toISOString().split('T')[0];
}

function detectType(text) {
  // Check income first since some SMS contain both keywords
  const incomeIdx = text.search(INCOME_KW);
  const expenseIdx = text.search(EXPENSE_KW);
  if (incomeIdx >= 0 && (expenseIdx < 0 || incomeIdx < expenseIdx)) return 'income';
  if (expenseIdx >= 0) return 'expense';
  return 'expense';
}

function detectPayment(text) {
  for (const [re, m] of PAYMENT_METHODS) { if (re.test(text)) return m; }
  return 'Other';
}

function detectMerchant(text) {
  for (const pat of MERCHANT_PATTERNS) {
    const m = text.match(pat);
    if (m) { let name = m[1].trim().replace(/\s+/g, ' ').replace(/[.]+$/, ''); if (name.length > 1 && name.length < 50) return name; }
  }
  return '';
}

function detectCategory(text, type) {
  for (const { kw, cat } of CATEGORY_MAP) { if (kw.test(text)) return cat; }
  return type === 'income' ? 'Other Income' : 'Other';
}

export function parseSMS(smsText) {
  if (!smsText || smsText.trim().length < 8) return { error: 'SMS too short', raw: smsText };
  const text = smsText.trim();
  const amount = parseAmount(text);
  if (!amount) return { error: 'Could not extract amount', raw: text };

  const type = detectType(text);
  const merchant = detectMerchant(text);
  const category = detectCategory(text + ' ' + merchant, type);
  const date = parseDate(text);
  const paymentMethod = detectPayment(text);
  const description = merchant ? `${type === 'income' ? 'Received from' : 'Paid to'} ${merchant}` : (type === 'income' ? 'Income received' : 'Payment made');

  return { type, amount, category, merchant, date, paymentMethod, description, raw: text };
}

export function parseBulkSMS(bulkText) {
  const lines = bulkText.split(/\n{2,}|\n/).map(s => s.trim()).filter(s => s.length > 8);
  return lines.map(parseSMS);
}
