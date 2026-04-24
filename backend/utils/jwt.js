// ============================================================================
// JWT UTILITY - Token generation & verification
// Access Token  → short-lived, sent on every request
// Refresh Token → long-lived, stored in DB, used to get new access token
// ============================================================================

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'rabs_access_secret_change_me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'rabs_refresh_secret_change_me';
const ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '24h';
const REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d';

/**
 * Generate Access Token (short-lived)
 * Contains: user_id, role_id, role_slug, username, db_name
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      roleId: payload.roleId,
      roleSlug: payload.roleSlug,
      roleLevel: payload.roleLevel,
      username: payload.username,
      dbName: payload.dbName,
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
};

/**
 * Generate Refresh Token (long-lived)
 * Contains minimal data - just user_id and db_name
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    {
      userId: payload.userId,
      dbName: payload.dbName,
      tokenId: crypto.randomUUID(), // Unique ID for this refresh token
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRY }
  );
};

/**
 * Verify Access Token
 */
const verifyAccessToken = (token) => {
  try {
    return { valid: true, decoded: jwt.verify(token, ACCESS_SECRET) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

/**
 * Verify Refresh Token
 */
const verifyRefreshToken = (token) => {
  try {
    return { valid: true, decoded: jwt.verify(token, REFRESH_SECRET) };
  } catch (err) {
    return { valid: false, error: err.message };
  }
};

/**
 * Hash a refresh token for DB storage (never store raw tokens)
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Get expiry date for refresh token
 */
const getRefreshExpiry = () => {
  const days = parseInt(REFRESH_EXPIRY) || 30;
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getRefreshExpiry,
};
