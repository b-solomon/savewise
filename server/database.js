import './loadEnv.js';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbType = 'sqlite';
let sqliteDb = null;
let pgPool = null;
export let isDbConnected = false;
export let dbConnectionError = null;

export function getDbStatus() {
  return { isDbConnected, dbConnectionError, dbType };
}

let dbInitPromise = null;

function initDatabase() {
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      if (process.env.DATABASE_URL) {
        console.log('Detected DATABASE_URL. Connecting to PostgreSQL...');
        let currentUrl = process.env.DATABASE_URL;
        
        let retries = 5;
        while (retries > 0) {
          try {
            const pg = await import('pg');
            const { Pool } = pg.default;
            if (pgPool) { try { await pgPool.end(); } catch {} }
            
            pgPool = new Pool({
              connectionString: currentUrl,
              ssl: { rejectUnauthorized: false },
              connectionTimeoutMillis: 5000
            });

            await pgPool.query('SELECT NOW()');
            dbType = 'postgres';
            isDbConnected = true;
            dbConnectionError = null;
            console.log('Connected to PostgreSQL (Supabase) successfully!');
            await initializePgSchema();
            return;
          } catch (err) {
            retries--;
            dbConnectionError = err.message;
            console.error(`PostgreSQL connection attempt failed. Retries remaining: ${retries}. Error: ${err.message}`);
            
            // Auto-switch between pooler port 6543 and session/direct port 5432 on EAUTHQUERY error
            if (err.message.includes('EAUTHQUERY') || err.message.includes('connection to database not available')) {
              if (currentUrl.includes(':6543')) {
                console.log('🔄 PgBouncer pooler port 6543 failed. Trying direct/session port 5432...');
                currentUrl = currentUrl.replace(':6543', ':5432');
              }
            }

            if (retries === 0) {
              console.warn('PostgreSQL connection failed. Falling back to local SQLite database...');
              try {
                await setupSQLite();
              } catch (sqErr) {
                console.error('CRITICAL: SQLite fallback failed:', sqErr.message);
              }
            } else {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
      } else {
        try {
          await setupSQLite();
        } catch (err) {
          isDbConnected = false;
          dbConnectionError = err.message;
          console.error('CRITICAL: Failed to initialize SQLite schema:', err.message);
        }
      }
    })();
  }
  return dbInitPromise;
}

export const ready = initDatabase();

function setupSQLite() {
  return new Promise((resolve, reject) => {
    const dbPath = path.resolve(__dirname, process.env.DATABASE_FILE || 'savewise.db');
    sqliteDb = new sqlite3.Database(dbPath, async (err) => {
      if (err) {
        console.error('SQLite DB connection error:', err.message);
        isDbConnected = false;
        dbConnectionError = err.message;
        reject(err);
      } else {
        console.log('Connected to SQLite:', dbPath);
        dbType = 'sqlite';
        isDbConnected = true;
        dbConnectionError = null;
        try {
          await initializeSqliteSchema();
          resolve();
        } catch (initErr) {
          console.error('CRITICAL: SQLite schema initialization failed:', initErr.message);
          isDbConnected = false;
          dbConnectionError = initErr.message;
          reject(initErr);
        }
      }
    });
  });
}

// SQLite Schema
function initializeSqliteSchema() {
  return new Promise((resolve, reject) => {
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
        if (err) {
          return reject(err);
        }
        if (row && row.count === 0) {
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
            [0,'Church','expense','⛪','#6366f1'],
            [0,'Stocks','expense','📈','#f59e0b'],
            [0,'Other','expense','📌','#6b7280'],
            [0,'Salary','income','💰','#10b981'],
            [0,'Freelance','income','💻','#22d3ee'],
            [0,'Investment','income','📈','#f59e0b'],
            [0,'Refund','income','↩️','#84cc16'],
            [0,'Other Income','income','💵','#84cc16']
          ];
          const stmt = sqliteDb.prepare('INSERT INTO categories (user_id,name,type,icon,color) VALUES (?,?,?,?,?)');
          cats.forEach(c => stmt.run(c));
          stmt.finalize((fErr) => {
            if (fErr) return reject(fErr);
            console.log('SQLite: Default categories seeded.');
            console.log('SQLite Database schema initialized.');
            resolve();
          });
        } else {
          // Ensure Church category exists for existing SQLite database
          sqliteDb.get("SELECT COUNT(*) as count FROM categories WHERE user_id = 0 AND name = 'Church'", (err2, row2) => {
            if (!err2 && row2 && row2.count === 0) {
              sqliteDb.run("INSERT INTO categories (user_id, name, type, icon, color) VALUES (0, 'Church', 'expense', '⛪', '#6366f1')");
              console.log('SQLite: Seeded "Church" category.');
            }
          });
          // Ensure Stocks category exists for existing SQLite database
          sqliteDb.get("SELECT COUNT(*) as count FROM categories WHERE user_id = 0 AND name = 'Stocks'", (err3, row3) => {
            if (!err3 && row3 && row3.count === 0) {
              sqliteDb.run("INSERT INTO categories (user_id, name, type, icon, color) VALUES (0, 'Stocks', 'expense', '📈', '#f59e0b')");
              console.log('SQLite: Seeded "Stocks" category.');
            }
            console.log('SQLite Database schema initialized.');
            resolve();
          });
        }
      });
    });
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
        [0,'Church','expense','⛪','#6366f1'],
        [0,'Stocks','expense','📈','#f59e0b'],
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
    } else {
      // Ensure Church category exists for existing PostgreSQL database
      const churchCheck = await pgPool.query("SELECT COUNT(*) FROM categories WHERE user_id = 0 AND name = 'Church'");
      if (parseInt(churchCheck.rows[0].count, 10) === 0) {
        await pgPool.query("INSERT INTO categories (user_id, name, type, icon, color) VALUES (0, 'Church', 'expense', '⛪', '#6366f1')");
        console.log('PostgreSQL: Seeded "Church" category.');
      }
      // Ensure Stocks category exists for existing PostgreSQL database
      const stocksCheck = await pgPool.query("SELECT COUNT(*) FROM categories WHERE user_id = 0 AND name = 'Stocks'");
      if (parseInt(stocksCheck.rows[0].count, 10) === 0) {
        await pgPool.query("INSERT INTO categories (user_id, name, type, icon, color) VALUES (0, 'Stocks', 'expense', '📈', '#f59e0b')");
        console.log('PostgreSQL: Seeded "Stocks" category.');
      }
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
  async run(sql, params = []) {
    await ready;
    if (!isDbConnected) {
      return Promise.reject(new Error(`Database connection is offline. Error: ${dbConnectionError || 'Database not initialized'}`));
    }
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
  async get(sql, params = []) {
    await ready;
    if (!isDbConnected) {
      return Promise.reject(new Error(`Database connection is offline. Error: ${dbConnectionError || 'Database not initialized'}`));
    }
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
  async all(sql, params = []) {
    await ready;
    if (!isDbConnected) {
      return Promise.reject(new Error(`Database connection is offline. Error: ${dbConnectionError || 'Database not initialized'}`));
    }
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

export default { sqliteDb, pgPool, query, isDbConnected, dbConnectionError };
