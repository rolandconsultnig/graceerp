require('./loadEnv');
const fs = require('fs');
const path = require('path');
const { createPool } = require('./createPool');

const pool = createPool();

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running GraceERP database migration...');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ Migration complete — all tables created.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
