const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'portfolio_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max:      10,               // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Cannot connect to PostgreSQL:', err.message);
    console.error('   Check your .env DB_* credentials and that Postgres is running.');
    process.exit(1);
  }
  console.log(`✅ PostgreSQL connected → ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  release();
});

/**
 * Convenience query wrapper with automatic error logging.
 * @param {string} text  - SQL query string
 * @param {Array}  params - Query parameters
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    if (process.env.NODE_ENV === 'development') {
      console.log(`  ⚡ query [${Date.now() - start}ms]:`, text.slice(0, 80));
    }
    return res;
  } catch (err) {
    console.error('❌ DB query error:', err.message);
    console.error('   Query:', text);
    throw err;
  }
};

module.exports = { pool, query };
