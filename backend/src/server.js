const crypto = require('crypto');
const path = require('path');

// Always load backend/.env (cwd is often repo root when using tooling — plain dotenv misses this).
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const MIN_JWT_SECRET_LEN = 32;

/** Production requires strong secrets from env; development auto-generates if missing so login works locally. */
function ensureJwtSecrets() {
  const isProd = process.env.NODE_ENV === 'production';

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = process.env[key];
    if (v && String(v).length >= MIN_JWT_SECRET_LEN) continue;

    if (isProd) {
      process.stderr.write(
        `[graceerp] ${key} must be set and at least ${MIN_JWT_SECRET_LEN} characters (copy backend/.env.example → backend/.env).\n`
      );
      process.exit(1);
    }

    process.env[key] = crypto.randomBytes(48).toString('hex');
    process.stderr.write(
      `[graceerp] ${key} missing or short — generated a temporary development secret (sessions reset when the server restarts).\n`
    );
  }
}

ensureJwtSecrets();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes       = require('./routes/auth');
const churchRoutes     = require('./routes/churches');
const branchRoutes     = require('./routes/branches');
const memberRoutes     = require('./routes/members');
const userRoutes       = require('./routes/users');
const financeRoutes    = require('./routes/finance');
const budgetRoutes     = require('./routes/budget');
const assetRoutes      = require('./routes/assets');
const sermonRoutes     = require('./routes/sermons');
const libraryRoutes    = require('./routes/library');
const meetingRoutes    = require('./routes/meetings');
const eventRoutes      = require('./routes/events');
const pastoralRoutes   = require('./routes/pastoral');
const commsRoutes      = require('./routes/communications');
const hrRoutes         = require('./routes/hr');
const facilityRoutes   = require('./routes/facilities');
const documentRoutes   = require('./routes/documents');
const analyticsRoutes  = require('./routes/analytics');
const auditRoutes      = require('./routes/audit');
const projectRoutes    = require('./routes/projects');
const memberPortalRoutes = require('./routes/memberPortal');

const app = express();

// ── Security middleware ────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:2025',
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Auth has stricter limits
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes' },
});

// ── General middleware ────────────────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: msg => logger.http(msg.trim()) } }));

// Static files (uploaded media)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Static files (frontend build)
app.use(express.static(path.join(__dirname, '../public')));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'GraceERP API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',            authLimiter, authRoutes);
app.use('/api/churches',        churchRoutes);
app.use('/api/branches',        branchRoutes);
app.use('/api/members',         memberRoutes);
app.use('/api/users',           userRoutes);
app.use('/api/finance',         financeRoutes);
app.use('/api/budget',          budgetRoutes);
app.use('/api/assets',          assetRoutes);
app.use('/api/sermons',         sermonRoutes);
app.use('/api/library',         libraryRoutes);
app.use('/api/meetings',        meetingRoutes);
app.use('/api/events',          eventRoutes);
app.use('/api/pastoral',        pastoralRoutes);
app.use('/api/communications',  commsRoutes);
app.use('/api/hr',              hrRoutes);
app.use('/api/facilities',      facilityRoutes);
app.use('/api/documents',       documentRoutes);
app.use('/api/analytics',       analyticsRoutes);
app.use('/api/audit',           auditRoutes);
app.use('/api/projects',        projectRoutes);
app.use('/api/member-portal',  memberPortalRoutes);

// ── Serve React app for all non-API routes (client-side routing) ─────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Error handling ────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 2020;
app.listen(PORT, () => {
  logger.info(`GraceERP API running on port ${PORT} [${process.env.NODE_ENV}]`);
});

module.exports = app;
