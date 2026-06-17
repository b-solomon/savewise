import './loadEnv.js';
import express from 'express';
import os from 'os';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import { query } from './database.js';
import { parseSMS, parseBulkSMS } from './smsParser.js';
import { importCSV } from './csvImporter.js';
import { getLivePrices, searchSymbol } from './marketData.js';
import { handleAiChat, generateMonthlyReport } from './aiAdvisor.js';
import { getAppKey, encrypt, decrypt } from './crypto.js';

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'savewise_secret';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token missing' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; next();
  });
};

// ═══ AUTH ═══
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const exists = await query.get('SELECT id FROM users WHERE email = ?', [email]);
    if (exists) return res.status(400).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 12);
    const r = await query.run('INSERT INTO users (email, password_hash, name) VALUES (?,?,?)', [email, hash, name || '']);
    const token = jwt.sign({ id: r.id, email, name }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user: { id: r.id, email, name } });
  } catch (e) { res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = await query.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await query.get('SELECT id,email,name,currency,created_at FROM users WHERE id=?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(user);
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// ═══ CATEGORIES ═══
app.get('/api/categories', auth, async (req, res) => {
  try { res.json(await query.all('SELECT * FROM categories WHERE user_id=0 OR user_id=? ORDER BY type,name', [req.user.id])); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ TRANSACTIONS ═══
app.post('/api/transactions/parse-sms', auth, async (req, res) => {
  const { smsText } = req.body;
  if (!smsText) return res.status(400).json({ error: 'SMS text required' });
  try {
    const p = parseSMS(smsText);
    if (p.error) return res.status(400).json(p);
    const key = getAppKey();
    const r = await query.run(
      'INSERT INTO transactions (user_id,type,amount,amount_enc,category,description,merchant,merchant_enc,date,payment_method,source,raw_sms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, p.type, p.amount, encrypt(String(p.amount), key), p.category, p.description, p.merchant, encrypt(p.merchant, key), p.date, p.paymentMethod, 'sms', encrypt(p.raw, key)]
    );
    res.status(201).json({ id: r.id, ...p });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Parse failed' }); }
});

app.post('/api/transactions/bulk-parse', auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'Messages required' });
  const text = Array.isArray(messages) ? messages.join('\n\n') : messages;
  const parsed = parseBulkSMS(text);
  const results = [];
  const key = getAppKey();
  for (const p of parsed) {
    if (p.error) { results.push(p); continue; }
    try {
      const r = await query.run(
        'INSERT INTO transactions (user_id,type,amount,amount_enc,category,description,merchant,merchant_enc,date,payment_method,source,raw_sms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [req.user.id, p.type, p.amount, encrypt(String(p.amount), key), p.category, p.description, p.merchant, encrypt(p.merchant, key), p.date, p.paymentMethod, 'sms', encrypt(p.raw, key)]
      );
      results.push({ id: r.id, ...p });
    } catch (e) { results.push({ ...p, error: 'Save failed' }); }
  }
  res.json({ total: results.length, success: results.filter(r => !r.error).length, results });
});

app.post('/api/transactions/import-csv', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  try {
    const content = req.file.buffer.toString('utf-8');
    const { error, results, total } = importCSV(content);
    if (error) return res.status(400).json({ error });
    const key = getAppKey();
    let success = 0;
    for (const r of results) {
      try {
        await query.run(
          'INSERT INTO transactions (user_id,type,amount,amount_enc,category,description,merchant,merchant_enc,date,payment_method,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [req.user.id, r.type, r.amount, encrypt(String(r.amount), key), r.category, r.description, r.merchant, encrypt(r.merchant, key), r.date, r.paymentMethod, 'csv']
        );
        success++;
      } catch (e) { /* skip duplicates */ }
    }
    res.json({ total, success, message: `${success}/${total} transactions imported` });
  } catch (e) { res.status(500).json({ error: 'Import failed' }); }
});

app.get('/api/transactions', auth, async (req, res) => {
  const { month, category, type } = req.query;
  let sql = 'SELECT * FROM transactions WHERE user_id=?';
  const params = [req.user.id];
  if (month) { sql += ' AND date LIKE ?'; params.push(month + '%'); }
  if (category) { sql += ' AND category=?'; params.push(category); }
  if (type) { sql += ' AND type=?'; params.push(type); }
  sql += ' ORDER BY date DESC, created_at DESC';
  try { res.json(await query.all(sql, params)); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/transactions', auth, async (req, res) => {
  const { type, amount, category, description, merchant, date, paymentMethod } = req.body;
  if (!type || !amount || !category || !date) return res.status(400).json({ error: 'type, amount, category, date required' });
  try {
    const key = getAppKey();
    const r = await query.run(
      'INSERT INTO transactions (user_id,type,amount,amount_enc,category,description,merchant,merchant_enc,date,payment_method,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [req.user.id, type, parseFloat(amount), encrypt(String(amount), key), category, description || '', merchant || '', encrypt(merchant || '', key), date, paymentMethod || 'Other', 'manual']
    );
    res.status(201).json({ id: r.id, type, amount: parseFloat(amount), category, description, merchant, date, paymentMethod, source: 'manual' });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/transactions/:id', auth, async (req, res) => {
  try { await query.run('DELETE FROM transactions WHERE id=? AND user_id=?', [parseInt(req.params.id, 10), req.user.id]); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/sync/simulate', auth, async (req, res) => {
  const { bank } = req.body;
  if (!bank) return res.status(400).json({ error: 'Bank name required' });

  const now = new Date();
  const dateStr = (offsetDays) => {
    const d = new Date();
    d.setDate(now.getDate() - offsetDays);
    return d.toISOString().split('T')[0];
  };

  const mockTxns = [
    { type: 'income', amount: 85000, category: 'Salary', description: `Salary from TCS via NEFT to ${bank}`, merchant: 'TCS', date: dateStr(25), paymentMethod: 'NEFT' },
    { type: 'expense', amount: 480, category: 'Food & Dining', description: 'Paid to Swiggy via UPI', merchant: 'Swiggy', date: dateStr(2), paymentMethod: 'UPI' },
    { type: 'expense', amount: 620, category: 'Food & Dining', description: 'Spent at Zomato via UPI', merchant: 'Zomato', date: dateStr(4), paymentMethod: 'UPI' },
    { type: 'expense', amount: 2200, category: 'Transport', description: 'Fuel purchase at Shell', merchant: 'Shell', date: dateStr(10), paymentMethod: 'Credit Card' },
    { type: 'expense', amount: 15000, category: 'Rent', description: 'Monthly rent paid to Landlord', merchant: 'Landlord', date: dateStr(5), paymentMethod: 'Net Banking' },
    { type: 'expense', amount: 3500, category: 'Shopping', description: 'Spent at Flipkart via UPI', merchant: 'Flipkart', date: dateStr(7), paymentMethod: 'UPI' },
    { type: 'expense', amount: 1200, category: 'Shopping', description: 'Spent at Amazon', merchant: 'Amazon', date: dateStr(12), paymentMethod: 'Credit Card' },
    { type: 'expense', amount: 649, category: 'Entertainment', description: 'Subscription for Netflix', merchant: 'Netflix', date: dateStr(1), paymentMethod: 'Auto Debit' },
    { type: 'expense', amount: 450, category: 'Health', description: 'Medicines at Apollo Pharmacy', merchant: 'Apollo Pharmacy', date: dateStr(15), paymentMethod: 'UPI' },
    { type: 'income', amount: 12000, category: 'Freelance', description: 'Freelance client payment', merchant: 'Upwork', date: dateStr(18), paymentMethod: 'IMPS' },
    { type: 'expense', amount: 5000, category: 'Investment', description: 'SIP Investment via Groww', merchant: 'Groww', date: dateStr(20), paymentMethod: 'UPI' },
    { type: 'expense', amount: 890, category: 'Groceries', description: 'Grocery shopping at Blinkit', merchant: 'Blinkit', date: dateStr(3), paymentMethod: 'UPI' },
    { type: 'expense', amount: 799, category: 'Bills & Utilities', description: 'Airtel Broadband Bill', merchant: 'Airtel', date: dateStr(8), paymentMethod: 'Auto Debit' }
  ];

  try {
    const key = getAppKey();
    let imported = 0;
    for (const t of mockTxns) {
      const exists = await query.get(
        'SELECT id FROM transactions WHERE user_id = ? AND amount = ? AND merchant = ? AND date = ?',
        [req.user.id, t.amount, t.merchant, t.date]
      );
      if (!exists) {
        await query.run(
          'INSERT INTO transactions (user_id,type,amount,amount_enc,category,description,merchant,merchant_enc,date,payment_method,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
          [req.user.id, t.type, t.amount, encrypt(String(t.amount), key), t.category, t.description, t.merchant, encrypt(t.merchant, key), t.date, t.paymentMethod, 'sync']
        );
        imported++;
      }
    }
    res.json({ message: `Successfully connected ${bank} and synced ${imported} transactions.`, count: imported });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to simulate bank sync data' });
  }
});


// ═══ DASHBOARD ═══
app.get('/api/dashboard/summary', auth, async (req, res) => {
  const month = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  try {
    const txns = await query.all('SELECT * FROM transactions WHERE user_id=? AND date LIKE ? ORDER BY date DESC', [req.user.id, month + '%']);
    const budgets = await query.all('SELECT * FROM budgets WHERE user_id=?', [req.user.id]);
    const cats = await query.all('SELECT * FROM categories WHERE user_id=0 OR user_id=?', [req.user.id]);
    const holdings = await query.all('SELECT * FROM holdings WHERE user_id=?', [req.user.id]);

    let totalIncome = 0, totalExpenses = 0;
    const catTotals = {}, dailyMap = {};
    txns.forEach(t => {
      if (t.type === 'income') totalIncome += t.amount; else totalExpenses += t.amount;
      if (t.type === 'expense') catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
      if (!dailyMap[t.date]) dailyMap[t.date] = { date: t.date, income: 0, expense: 0 };
      dailyMap[t.date][t.type === 'income' ? 'income' : 'expense'] += t.amount;
    });

    const catLookup = {}; cats.forEach(c => { catLookup[c.name] = c; });
    const categoryBreakdown = Object.entries(catTotals).map(([cat, total]) => {
      const info = catLookup[cat] || {};
      const budget = budgets.find(b => b.category === cat);
      return { category: cat, total: Math.round(total * 100) / 100, icon: info.icon || '📌', color: info.color || '#6b7280',
        budget: budget?.monthly_limit || null, budgetPercent: budget ? Math.round(total / budget.monthly_limit * 100) : null };
    }).sort((a, b) => b.total - a.total);

    // Portfolio summary
    let portfolioValue = 0, portfolioInvested = 0;
    if (holdings.length > 0) {
      holdings.forEach(h => { portfolioInvested += h.avg_buy_price * h.quantity; });
      try { const live = await getLivePrices(holdings); live.forEach(h => { portfolioValue += h.currentValue; }); }
      catch { portfolioValue = portfolioInvested; }
    }

    res.json({
      month, totalIncome: Math.round(totalIncome * 100) / 100, totalExpenses: Math.round(totalExpenses * 100) / 100,
      balance: Math.round((totalIncome - totalExpenses) * 100) / 100, categoryBreakdown,
      dailyTrend: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date)),
      recentTransactions: txns.slice(0, 10), transactionCount: txns.length,
      portfolioValue: Math.round(portfolioValue), portfolioInvested: Math.round(portfolioInvested),
      portfolioPnl: Math.round(portfolioValue - portfolioInvested), holdingsCount: holdings.length
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Dashboard failed' }); }
});

// ═══ PORTFOLIO / HOLDINGS ═══
app.get('/api/holdings', auth, async (req, res) => {
  try {
    const holdings = await query.all('SELECT * FROM holdings WHERE user_id=? ORDER BY created_at DESC', [req.user.id]);
    if (holdings.length === 0) return res.json([]);
    const live = await getLivePrices(holdings);
    res.json(live);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/holdings', auth, async (req, res) => {
  const { symbol, name, exchange, quantity, avgBuyPrice, buyDate, assetType } = req.body;
  if (!symbol || !quantity || !avgBuyPrice) return res.status(400).json({ error: 'symbol, quantity, avgBuyPrice required' });
  try {
    const r = await query.run(
      'INSERT INTO holdings (user_id,symbol,name,exchange,quantity,avg_buy_price,buy_date,asset_type,source) VALUES (?,?,?,?,?,?,?,?,?)',
      [req.user.id, symbol.toUpperCase(), name || '', exchange || 'NSE', parseFloat(quantity), parseFloat(avgBuyPrice), buyDate || new Date().toISOString().split('T')[0], assetType || 'stock', 'manual']
    );
    res.status(201).json({ id: r.id, symbol: symbol.toUpperCase(), quantity: parseFloat(quantity), avg_buy_price: parseFloat(avgBuyPrice) });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/holdings/:id', auth, async (req, res) => {
  try { await query.run('DELETE FROM holdings WHERE id=? AND user_id=?', [parseInt(req.params.id, 10), req.user.id]); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/holdings/search', auth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 1) return res.json([]);
  try { res.json(await searchSymbol(q)); }
  catch (e) { res.json([]); }
});

// ═══ BUDGETS ═══
app.get('/api/budgets', auth, async (req, res) => {
  try { res.json(await query.all('SELECT * FROM budgets WHERE user_id=?', [req.user.id])); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/budgets', auth, async (req, res) => {
  const { category, monthlyLimit } = req.body;
  if (!category || !monthlyLimit) return res.status(400).json({ error: 'Category and limit required' });
  try {
    await query.run('INSERT OR REPLACE INTO budgets (user_id,category,monthly_limit) VALUES (?,?,?)', [req.user.id, category, parseFloat(monthlyLimit)]);
    res.status(201).json({ message: 'Budget set' });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/budgets/:id', auth, async (req, res) => {
  try { await query.run('DELETE FROM budgets WHERE id=? AND user_id=?', [parseInt(req.params.id, 10), req.user.id]); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ SAVINGS GOALS ═══
app.get('/api/savings-goals', auth, async (req, res) => {
  try { res.json(await query.all('SELECT * FROM savings_goals WHERE user_id=? ORDER BY created_at DESC', [req.user.id])); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/savings-goals', auth, async (req, res) => {
  const { name, targetAmount, deadline, icon } = req.body;
  if (!name || !targetAmount) return res.status(400).json({ error: 'Name and target required' });
  try {
    const r = await query.run('INSERT INTO savings_goals (user_id,name,target_amount,deadline,icon) VALUES (?,?,?,?,?)', [req.user.id, name, parseFloat(targetAmount), deadline || null, icon || '🎯']);
    res.status(201).json({ id: r.id, name, target_amount: parseFloat(targetAmount), current_amount: 0, deadline, icon: icon || '🎯' });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/savings-goals/:id/contribute', auth, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
  try {
    await query.run('UPDATE savings_goals SET current_amount=current_amount+? WHERE id=? AND user_id=?', [parseFloat(amount), parseInt(req.params.id, 10), req.user.id]);
    res.json(await query.get('SELECT * FROM savings_goals WHERE id=?', [parseInt(req.params.id, 10)]));
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/savings-goals/:id', auth, async (req, res) => {
  try { await query.run('DELETE FROM savings_goals WHERE id=? AND user_id=?', [parseInt(req.params.id, 10), req.user.id]); res.json({ message: 'Deleted' }); }
  catch (e) { res.status(500).json({ error: 'Failed' }); }
});

// ═══ AI ═══
app.post('/api/ai/chat', auth, async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Messages required' });
  try { res.json(await handleAiChat(req.user.id, messages)); }
  catch (e) { res.status(500).json({ error: 'AI failed' }); }
});

app.get('/api/ai/monthly-report', auth, async (req, res) => {
  const month = req.query.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  try {
    const existing = await query.get('SELECT * FROM ai_reports WHERE user_id=? AND month=?', [req.user.id, month]);
    if (existing) return res.json({ report: existing.report, month, savingsRate: existing.savings_rate, cached: true });
    res.json(await generateMonthlyReport(req.user.id, month));
  } catch (e) { res.status(500).json({ error: 'Report failed' }); }
});

// ═══ SYSTEM / DIAGNOSTICS ═══
app.get('/api/system/ip', auth, (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    let ip = 'localhost';
    outer: for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
            ip = iface.address;
            break outer;
          }
        }
      }
    }
    res.json({ ip });
  } catch (e) {
    res.json({ ip: 'localhost' });
  }
});

app.listen(PORT, () => console.log(`\n🟢 SaveWise server running on http://localhost:${PORT}\n`));
