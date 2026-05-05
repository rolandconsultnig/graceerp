/**
 * One-off / dev: set known demo password for seed emails (see README / database/seed.js).
 * Usage: node scripts/reset-demo-passwords.js
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const DEMO = process.argv[2] || 'GraceERP@2025';
const EMAILS = [
  'admin@clci.org',
  'finance@clci.org',
  'lagos.admin@clci.org',
  'pastor@clci.org',
  'member@clci.org',
];

const p = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

(async () => {
  const hash = await bcrypt.hash(DEMO, 10);
  for (const email of EMAILS) {
    const r = await p.query(
      'UPDATE users SET password_hash = $1 WHERE LOWER(email) = LOWER($2)',
      [hash, email]
    );
    if (r.rowCount > 0) console.log('Updated:', email);
  }
  await p.end();
  console.log('Done.');
})();
