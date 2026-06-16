import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, process.env.DATABASE_FILE || 'savewise.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('DB connection error:', err.message);
  else { console.log('Connected to SQLite:', dbPath); initializeSchema(); }
});

function initializeSchema() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      currency TEXT DEFAULT 'INR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      amount REAL NOT NULL,
      amount_enc TEXT DEFAULT '',
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      merchant TEXT DEFAULT '',
      merchant_enc TEXT DEFAULT '',
      date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'Other',
      source TEXT DEFAULT 'manual',
      raw_sms TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT DEFAULT '',
      exchange TEXT DEFAULT 'NSE',
      quantity REAL NOT NULL,
      avg_buy_price REAL NOT NULL,
      buy_date TEXT,
      asset_type TEXT DEFAULT 'stock',
      source TEXT DEFAULT 'manual',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      deadline TEXT,
      icon TEXT DEFAULT '🎯',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      icon TEXT DEFAULT '📌',
      color TEXT DEFAULT '#6b7280'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ai_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      report TEXT NOT NULL,
      spending_score REAL,
      savings_rate REAL,
      generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Seed default categories
    db.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
      if (!err && row.count === 0) {
        const cats = [
          [0,'Food & Dining','expense','🍕','#f97316'],
          [0,'Transport','expense','🚗','#3b82f6'],
          [0,'Shopping','expense','🛍️','#a855f7'],
          [0,'Rent','expense','🏠','#6366f1'],
          [0,'Bills & Utilities','expense','📱','#eab308'],
          [0,'Entertainment','expense','🎬','#ec4899'],
          [0,'Health','expense','💊','#14b8a6'],
          [0,'Education','expense','📚','#8b5cf6'],
          [0,'Groceries','expense','🛒','#22c55e'],
          [0,'Insurance','expense','🛡️','#64748b'],
          [0,'EMI & Loans','expense','🏦','#dc2626'],
          [0,'Other','expense','📌','#6b7280'],
          [0,'Salary','income','💰','#10b981'],
          [0,'Freelance','income','💻','#22d3ee'],
          [0,'Investment','income','📈','#f59e0b'],
          [0,'Refund','income','↩️','#84cc16'],
          [0,'Other Income','income','💵','#84cc16']
        ];
        const stmt = db.prepare('INSERT INTO categories (user_id,name,type,icon,color) VALUES (?,?,?,?,?)');
        cats.forEach(c => stmt.run(c));
        stmt.finalize();
        console.log('Default categories seeded.');
      }
    });
    console.log('Database schema initialized.');
  });
}

export const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) { err ? reject(err) : resolve({ id: this.lastID, changes: this.changes }); });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => { err ? reject(err) : resolve(row); });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => { err ? reject(err) : resolve(rows || []); });
    });
  }
};

export default db;
