import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbType = 'sqlite';
let sqliteDb = null;
let pgPool = null;

// Initializer
async function initDatabase() {
  if (process.env.DATABASE_URL) {
    console.log('Detected DATABASE_URL. Connecting to PostgreSQL...');
    try {
      const pg = await import('pg');
      const { Pool } = pg.default;
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Supabase secure connections
      });
      
      let retries = 5;
      while (retries > 0) {
        try {
          await pgPool.query('SELECT NOW()');
          dbType = 'postgres';
          console.log('Connected to PostgreSQL (Supabase) successfully!');
          await initializePgSchema();
          return;
        } catch (err) {
          retries--;
          console.error(`PostgreSQL connection attempt failed. Retries remaining: ${retries}. Error: ${err.message}`);
          if (retries === 0) {
            console.error('CRITICAL: Failed to connect to PostgreSQL after 5 attempts. Exiting process to prevent silent SQLite fallback and data loss.');
            process.exit(1);
          }
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    } catch (err) {
      console.error('CRITICAL: Initialization error for PostgreSQL Pool:', err.message);
      process.exit(1);
    }
  } else {
    setupSQLite();
  }
}

function setupSQLite() {
  const dbPath = path.resolve(__dirname, process.env.DATABASE_FILE || 'savewise.db');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('SQLite DB connection error:', err.message);
    else {
      console.log('Connected to SQLite:', dbPath);
      initializeSqliteSchema();
    }
  });
  dbType = 'sqlite';
}

// SQLite Schema
function initializeSqliteSchema() {
  sqliteDb.serialize(() => {
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      currency TEXT DEFAULT 'INR',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS transactions (
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

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS holdings (
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

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS savings_goals (
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

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT 0,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income','expense')),
      icon TEXT DEFAULT '📌',
      color TEXT DEFAULT '#6b7280'
    )`);

    sqliteDb.run(`CREATE TABLE IF NOT EXISTS ai_reports (
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
    sqliteDb.get('SELECT COUNT(*) as count FROM categories', (err, row) => {
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
        const stmt = sqliteDb.prepare('INSERT INTO categories (user_id,name,type,icon,color) VALUES (?,?,?,?,?)');
        cats.forEach(c => stmt.run(c));
        stmt.finalize();
        console.log('SQLite: Default categories seeded.');
      }
    });
    console.log('SQLite Database schema initialized.');
  });
}

// PostgreSQL Schema
async function initializePgSchema() {
  try {
    await pgPool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      currency VARCHAR(10) DEFAULT 'INR',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type VARCHAR(10) NOT NULL CHECK(type IN ('income','expense')),
      amount DOUBLE PRECISION NOT NULL,
      amount_enc TEXT DEFAULT '',
      category VARCHAR(100) NOT NULL,
      description TEXT DEFAULT '',
      merchant VARCHAR(255) DEFAULT '',
      merchant_enc TEXT DEFAULT '',
      date VARCHAR(20) NOT NULL,
      payment_method VARCHAR(50) DEFAULT 'Other',
      source VARCHAR(20) DEFAULT 'manual',
      raw_sms TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS holdings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      symbol VARCHAR(50) NOT NULL,
      name VARCHAR(255) DEFAULT '',
      exchange VARCHAR(20) DEFAULT 'NSE',
      quantity DOUBLE PRECISION NOT NULL,
      avg_buy_price DOUBLE PRECISION NOT NULL,
      buy_date VARCHAR(20),
      asset_type VARCHAR(20) DEFAULT 'stock',
      source VARCHAR(20) DEFAULT 'manual',
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS budgets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      category VARCHAR(100) NOT NULL,
      monthly_limit DOUBLE PRECISION NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, category),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS savings_goals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name VARCHAR(255) NOT NULL,
      target_amount DOUBLE PRECISION NOT NULL,
      current_amount DOUBLE PRECISION DEFAULT 0,
      deadline VARCHAR(20),
      icon VARCHAR(50) DEFAULT '🎯',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      user_id INTEGER DEFAULT 0,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(10) NOT NULL CHECK(type IN ('income','expense')),
      icon VARCHAR(50) DEFAULT '📌',
      color VARCHAR(20) DEFAULT '#6b7280'
    )`);

    await pgPool.query(`CREATE TABLE IF NOT EXISTS ai_reports (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      month VARCHAR(20) NOT NULL,
      report TEXT NOT NULL,
      spending_score DOUBLE PRECISION,
      savings_rate DOUBLE PRECISION,
      generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    // Seed default categories
    const countRes = await pgPool.query('SELECT COUNT(*) FROM categories');
    if (parseInt(countRes.rows[0].count, 10) === 0) {
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
      for (const c of cats) {
        await pgPool.query('INSERT INTO categories (user_id,name,type,icon,color) VALUES ($1,$2,$3,$4,$5)', c);
      }
      console.log('PostgreSQL: Default categories seeded.');
    }
    console.log('PostgreSQL Database schema initialized.');
  } catch (err) {
    console.error('PostgreSQL Schema Initialization Error:', err.message);
  }
}

// SQL translator helper
function translateSql(sql) {
  let translated = sql;
  
  // 1. Translate SQLite UPSERT (INSERT OR REPLACE) to PG standard upsert
  if (translated.toUpperCase().includes('INSERT OR REPLACE INTO BUDGETS')) {
    translated = `INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)
                  ON CONFLICT (user_id, category) 
                  DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit`;
  }

  // 2. Translate SQLite "?" placeholders to PostgreSQL "$1, $2, $3" placeholders
  let paramCount = 1;
  while (translated.includes('?')) {
    translated = translated.replace('?', `$${paramCount}`);
    paramCount++;
  }

  // 3. For INSERT statements, append RETURNING id to extract lastID
  if (translated.toUpperCase().startsWith('INSERT') && !translated.toUpperCase().includes('RETURNING')) {
    translated += ' RETURNING id';
  }

  return translated;
}

// Initial connection trigger
initDatabase();

export const query = {
  run(sql, params = []) {
    if (dbType === 'postgres') {
      const tSql = translateSql(sql);
      return pgPool.query(tSql, params)
        .then(res => {
          const lastID = res.rows[0]?.id || null;
          return { id: lastID, changes: res.rowCount };
        });
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function(err) {
          err ? reject(err) : resolve({ id: this.lastID, changes: this.changes });
        });
      });
    }
  },
  get(sql, params = []) {
    if (dbType === 'postgres') {
      const tSql = translateSql(sql);
      return pgPool.query(tSql, params)
        .then(res => res.rows[0] || null);
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => {
          err ? reject(err) : resolve(row);
        });
      });
    }
  },
  all(sql, params = []) {
    if (dbType === 'postgres') {
      const tSql = translateSql(sql);
      return pgPool.query(tSql, params)
        .then(res => res.rows || []);
    } else {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          err ? reject(err) : resolve(rows || []);
        });
      });
    }
  }
};

export default { sqliteDb, pgPool, query };
