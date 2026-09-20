const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.POSTGRES_USER || 'vyapari_admin'}:${process.env.POSTGRES_PASSWORD || 'vyapari_secure_password'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'vyapari'}`,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB Pool Error]', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
};
