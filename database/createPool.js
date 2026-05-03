/**
 * Shared pg Pool options for migrate/seed — matches backend SASR/password behaviour.
 */
const { Pool } = require('pg');

function createPool() {
  const rawDbPassword =
    process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== null
      ? String(process.env.DB_PASSWORD)
      : '';

  if (!rawDbPassword.trim()) {
    console.error(
      'DB_PASSWORD is missing or empty. Set it in backend/.env (see backend/.env.example).'
    );
    process.exit(1);
  }

  return new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'graceerp',
    user: process.env.DB_USER || 'postgres',
    password: () => rawDbPassword,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
}

module.exports = { createPool };
