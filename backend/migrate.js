require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('./db');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('[DB] Connected to Aiven PostgreSQL');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        username    VARCHAR(50)  UNIQUE NOT NULL,
        email       VARCHAR(100) UNIQUE NOT NULL,
        password    TEXT         NOT NULL,
        age         INTEGER,
        weight      NUMERIC(5,1),
        height      NUMERIC(5,1),
        goal        INTEGER DEFAULT 2000,
        created_at  TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DB] ✓ users table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS meals (
        id          SERIAL PRIMARY KEY,
        username    VARCHAR(50)  NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        date        DATE         NOT NULL,
        meal_type   VARCHAR(20)  NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner')),
        food_name   VARCHAR(200) NOT NULL,
        calories    NUMERIC(8,1) DEFAULT 0,
        protein     NUMERIC(8,1) DEFAULT 0,
        carbs       NUMERIC(8,1) DEFAULT 0,
        fat         NUMERIC(8,1) DEFAULT 0,
        fiber       NUMERIC(8,1) DEFAULT 0,
        serving     VARCHAR(100),
        logged_at   TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DB] ✓ meals table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS food_cache (
        id           SERIAL PRIMARY KEY,
        food_id      VARCHAR(100) UNIQUE,
        name         VARCHAR(200) NOT NULL,
        calories     NUMERIC(8,1) DEFAULT 0,
        protein      NUMERIC(8,1) DEFAULT 0,
        carbs        NUMERIC(8,1) DEFAULT 0,
        fat          NUMERIC(8,1) DEFAULT 0,
        fiber        NUMERIC(8,1) DEFAULT 0,
        serving      VARCHAR(100),
        health_labels TEXT[],
        category     VARCHAR(100),
        source       VARCHAR(20) DEFAULT 'api',
        cached_at    TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DB] ✓ food_cache table ready');

    console.log('[DB] Migration complete');
  } catch (err) {
    console.error('[DB] Migration failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
