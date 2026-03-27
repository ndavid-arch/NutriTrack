const { Pool } = require('pg');

// Strip sslmode from the URL so pg doesn't conflict with our ssl config
const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected client error:', err.message);
});

module.exports = pool;
