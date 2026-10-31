import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or DIRECT_URL environment variable is missing.');
}

// Global pool cache for Next.js hot-reloading
const globalForDb = globalThis;

export const pool = globalForDb.pgPool || new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 15,
  idleTimeoutMillis: 30000,
});

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pgPool = pool;
}

export async function query(text, params) {
  return pool.query(text, params);
}

