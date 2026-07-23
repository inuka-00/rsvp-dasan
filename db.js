const path = require('path');

// Determine database type based on environment variable
const isPostgres = !!process.env.DATABASE_URL;

let pgPool;
let sqliteDb;
let initializedPromise = null;

async function ensureDb() {
  if (initializedPromise) return initializedPromise;
  
  initializedPromise = (async () => {
    if (isPostgres) {
      const { Pool } = require('pg');
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      });
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS rsvps (
          id SERIAL PRIMARY KEY,
          guest_name TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Database initialized: PostgreSQL/Supabase');
    } else {
      const sqlite3 = require('sqlite3').verbose();
      const { open } = require('sqlite');
      
      const dbPath = path.join(__dirname, 'wedding.db');
      sqliteDb = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
      await sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS rsvps (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guest_name TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('Database initialized: SQLite (local)');
    }
  })();
  
  return initializedPromise;
}

async function insertRsvp(guestName, status) {
  await ensureDb();
  if (isPostgres) {
    await pgPool.query(
      'INSERT INTO rsvps (guest_name, status) VALUES ($1, $2)',
      [guestName, status]
    );
  } else {
    await sqliteDb.run(
      'INSERT INTO rsvps (guest_name, status, created_at) VALUES (?, ?, DATETIME(CURRENT_TIMESTAMP, "localtime"))',
      [guestName, status]
    );
  }
}

async function getRsvps() {
  await ensureDb();
  if (isPostgres) {
    const result = await pgPool.query(
      'SELECT id, guest_name, status, created_at FROM rsvps ORDER BY created_at DESC'
    );
    return result.rows;
  } else {
    return await sqliteDb.all(
      'SELECT id, guest_name, status, created_at FROM rsvps ORDER BY created_at DESC'
    );
  }
}

async function getRsvpStats() {
  await ensureDb();
  if (isPostgres) {
    const result = await pgPool.query(`
      SELECT 
        COUNT(*)::integer as total,
        COALESCE(SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END), 0)::integer as attending,
        COALESCE(SUM(CASE WHEN status = 'Declined' THEN 1 ELSE 0 END), 0)::integer as declining
      FROM rsvps
    `);
    return result.rows[0];
  } else {
    const stats = await sqliteDb.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Accepted' THEN 1 ELSE 0 END) as attending,
        SUM(CASE WHEN status = 'Declined' THEN 1 ELSE 0 END) as declining
      FROM rsvps
    `);
    return {
      total: stats.total || 0,
      attending: stats.attending || 0,
      declining: stats.declining || 0
    };
  }
}

module.exports = {
  insertRsvp,
  getRsvps,
  getRsvpStats
};
