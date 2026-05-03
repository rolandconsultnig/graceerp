const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = require('pg');
const logger = require('../utils/logger');

const host = process.env.DB_HOST || 'localhost';
const port = parseInt(process.env.DB_PORT, 10) || 5432;
const database = process.env.DB_NAME || 'graceerp';
const user = process.env.DB_USER || 'postgres';

const rawDbPassword =
  process.env.DB_PASSWORD !== undefined && process.env.DB_PASSWORD !== null
    ? String(process.env.DB_PASSWORD)
    : '';

if (!rawDbPassword.trim()) {
  logger.error(
    'DB_PASSWORD is missing or empty. Copy backend/.env.example to backend/.env and set DB_PASSWORD to your PostgreSQL password.'
  );
  process.exit(1);
}

const enc = encodeURIComponent;
const connectionString = `postgresql://${enc(user)}:${enc(rawDbPassword)}@${host}:${port}/${enc(database)}`;

const pool = new Pool({
  connectionString,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  logger.info('PostgreSQL client connected');
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL error', err);
  process.exit(-1);
});

// Helper: run a query with automatic client release
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    logger.error('Query error', { text, error: err.message });
    throw err;
  }
};

// Helper: get a dedicated client for transactions
const getClient = async () => {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  const originalRelease = client.release.bind(client);

  const timeout = setTimeout(() => {
    logger.error('Client checked out for too long');
  }, 5000);

  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };

  client.release = () => {
    clearTimeout(timeout);
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease();
  };

  return client;
};

module.exports = { pool, query, getClient };
