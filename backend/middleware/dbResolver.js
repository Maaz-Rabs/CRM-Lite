// ============================================================================
// DATABASE RESOLVER MIDDLEWARE
// Resolves which client database to use based on request
// Options: header (x-client-db), query param, or default from .env
// ============================================================================

const { getPool, testConnection } = require('../config/database');
const response = require('../utils/response');

/**
 * Resolve client database from request
 * Priority:
 *   1. x-client-db header (sent by mobile app after verify step)
 *   2. ?db= query parameter
 *   3. Default from .env (DB_NAME)
 *
 * After this middleware:
 *   req.dbName → database name string
 *   req.db     → mysql2 pool for this database
 */
const resolveDatabase = (req, res, next) => {
  try {
    // Get database name from multiple sources
    const dbName =
      req.headers['x-client-db'] ||
      req.query.db ||
      process.env.DB_NAME ||
      'rabsconnect_aarohan';

    // Sanitize: only allow alphanumeric + underscore
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
      return response.error(res, 'Invalid database name', 400);
    }

    // Attach to request
    req.dbName = dbName;
    req.db = getPool(dbName);

    next();
  } catch (err) {
    console.error('[DB RESOLVER]', err);
    return response.error(res, 'Database connection failed', 500);
  }
};

module.exports = { resolveDatabase };
