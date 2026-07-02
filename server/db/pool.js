import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// Neon (and most managed Postgres hosts) require SSL. If DATABASE_SSL isn't
// explicitly set, detect it from the connection string itself so a missing
// env var on Vercel doesn't silently break every single request.
const connectionString = process.env.DATABASE_URL || '';
const looksManaged = /neon\.tech|sslmode=require|render\.com|supabase\.co/i.test(connectionString);
const sslEnabled = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL === 'true'
  : looksManaged;

export const pool = new Pool({
  connectionString,
  ssl: sslEnabled ? { rejectUnauthorized: false } : false,
  max: 12,
  idleTimeoutMillis: 30000
});

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function one(query, params = []) {
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}

export async function many(query, params = []) {
  const { rows } = await pool.query(query, params);
  return rows;
}
