// ============================================================================
// AUTH MIDDLEWARE
// Verifies JWT access token on protected routes
// Attaches user info + db pool to request object
// ============================================================================

const { verifyAccessToken } = require('../utils/jwt');
const { getPool } = require('../config/database');
const response = require('../utils/response');

/**
 * Authenticate request via Bearer token
 * After this middleware, req has:
 *   req.user   → { userId, roleId, roleSlug, roleLevel, username, dbName }
 *   req.dbName → database name string
 *   req.db     → mysql2 pool for this client's database
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.error(res, 'Access token is required', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return response.error(res, 'Access token is required', 401);
    }

    // Verify token
    const result = verifyAccessToken(token);

    if (!result.valid) {
      if (result.error === 'jwt expired') {
        return response.error(res, 'Access token expired. Please refresh.', 401);
      }
      return response.error(res, 'Invalid access token', 401);
    }

    // Attach user data to request
    req.user = result.decoded;
    req.dbName = result.decoded.dbName;

    // Attach database pool for this client
    req.db = getPool(result.decoded.dbName);

    // Check if user is still active
    try {
      const [rows] = await req.db.query('SELECT is_active FROM users WHERE u_id = ?', [req.user.userId]);
      if (rows.length === 0 || !rows[0].is_active) {
        return response.error(res, 'Your account has been deactivated. Please contact admin.', 403);
      }
    } catch (dbErr) {
      // If DB check fails, allow through (don't block on transient DB errors)
      console.error('[AUTH] is_active check failed:', dbErr.message);
    }

    next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE]', err);
    return response.error(res, 'Authentication failed', 401);
  }
};

/**
 * Require specific role level (or higher)
 * Lower level number = higher authority (Master=1, Admin=2, etc.)
 * @param {number} maxLevel - Maximum role level allowed (inclusive)
 */
const requireLevel = (maxLevel) => {
  return (req, res, next) => {
    if (!req.user) {
      return response.error(res, 'Authentication required', 401);
    }

    if (req.user.roleLevel > maxLevel) {
      return response.error(res, 'You do not have permission to access this resource', 403);
    }

    next();
  };
};

/**
 * Require specific role slug(s)
 * @param  {...string} slugs - Allowed role slugs
 */
const requireRole = (...slugs) => {
  return (req, res, next) => {
    if (!req.user) {
      return response.error(res, 'Authentication required', 401);
    }

    if (!slugs.includes(req.user.roleSlug)) {
      return response.error(res, 'You do not have permission to access this resource', 403);
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireLevel,
  requireRole,
};
