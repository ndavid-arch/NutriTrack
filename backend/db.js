const { Pool } = require('pg');

// Aiven includes sslmode in the connection URI, but the pg driver also
// receives an ssl object below — having both causes a conflict, so we
// strip the sslmode query parameter from the URL before passing it in.
const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');

// Pool maintains a set of reusable database connections.
// rejectUnauthorized: false trusts Aiven's self-signed SSL certificate
// without needing to bundle the CA certificate file locally.
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Log unexpected errors on idle clients so they don't crash the server silently
pool.on('error', (err) => {
  console.error('[DB] Unexpected client error:', err.message);
});

module.exports = pool;
