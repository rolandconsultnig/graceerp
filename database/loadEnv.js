/**
 * Load backend/.env regardless of cwd (migrate/seed run via npm from backend/).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
require('dotenv').config();
