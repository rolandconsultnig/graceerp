const logger = require('../utils/logger');

// 404 handler
const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // PostgreSQL unique violation
  if (err.code === '23505') {
    statusCode = 409;
    message = 'A record with this value already exists';
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  // DB unreachable / driver auth handshake (wrong DB_PASSWORD, SASL, TCP)
  const msg = typeof err.message === 'string' ? err.message : '';
  if (
    err.code === 'ECONNREFUSED' ||
    err.code === 'ENOTFOUND' ||
    err.code === 'ETIMEDOUT' ||
    err.code === '28P01' ||
    msg.includes('SASL') ||
    msg.includes('password authentication failed')
  ) {
    statusCode = 503;
    message =
      process.env.NODE_ENV === 'development'
        ? msg || 'Database connection failed'
        : 'Database unavailable. Try again later.';
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    statusCode = 422;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
  }

  if (process.env.NODE_ENV === 'development') {
    logger.error(err.stack);
  } else {
    logger.error(message, { statusCode, path: req.path });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Async handler wrapper — eliminates try/catch boilerplate in controllers
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
