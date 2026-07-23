const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Determine database connection method based on environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const isSupabase = !!(supabaseUrl && supabaseKey);
const isPostgres = !isSupabase && !!process.env.DATABASE_URL;

let supabase;
let pgPool;
let sqliteDb;
let initializedPromise = null;

async function ensureDb() {
  if (initializedPromise) return initializedPromise;
  
  initializedPromise = (async () => {
    if (isSupabase) {
      supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Database initialized: Supabase Client (createClient)');
    } else if (isPostgres) {
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
          comment TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS comment TEXT;
      `);
      console.log('Database initialized: PostgreSQL (DATABASE_URL)');
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
          comment TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      try {
        await sqliteDb.exec(`ALTER TABLE rsvps ADD COLUMN comment TEXT`);
      } catch (e) {
        // Column already exists
      }
      console.log('Database initialized: SQLite (local)');
    }
  })();
  
  return initializedPromise;
}

async function insertRsvp(guestName, status, comment = '') {
  await ensureDb();
  if (isSupabase) {
    const { error } = await supabase
      .from('rsvps')
      .insert([
        { guest_name: guestName, status: status, comment: comment }
      ]);
    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
  } else if (isPostgres) {
    await pgPool.query(
      'INSERT INTO rsvps (guest_name, status, comment) VALUES ($1, $2, $3)',
      [guestName, status, comment]
    );
  } else {
    await sqliteDb.run(
      'INSERT INTO rsvps (guest_name, status, comment, created_at) VALUES (?, ?, ?, DATETIME(CURRENT_TIMESTAMP, "localtime"))',
      [guestName, status, comment]
    );
  }
}

async function getRsvps() {
  await ensureDb();
  if (isSupabase) {
    const { data, error } = await supabase
      .from('rsvps')
      .select('id, guest_name, status, comment, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase getRsvps error:', error);
      throw error;
    }
    return data || [];
  } else if (isPostgres) {
    const result = await pgPool.query(
      'SELECT id, guest_name, status, comment, created_at FROM rsvps ORDER BY created_at DESC'
    );
    return result.rows;
  } else {
    return await sqliteDb.all(
      'SELECT id, guest_name, status, comment, created_at FROM rsvps ORDER BY created_at DESC'
    );
  }
}

async function getRsvpStats() {
  await ensureDb();
  if (isSupabase) {
    const { data, error } = await supabase
      .from('rsvps')
      .select('status');
    if (error) {
      console.error('Supabase getRsvpStats error:', error);
      throw error;
    }
    const rsvps = data || [];
    const total = rsvps.length;
    const attending = rsvps.filter(r => r.status === 'Accepted').length;
    const declining = rsvps.filter(r => r.status === 'Declined').length;
    return { total, attending, declining };
  } else if (isPostgres) {
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
