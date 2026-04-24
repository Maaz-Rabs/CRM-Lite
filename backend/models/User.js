// ============================================================================
// USER MODEL
// Database queries for user operations
// All methods take db pool as first parameter (multi-tenant)
// ============================================================================

/**
 * Find user by username (for login)
 * Joins with roles to get role info
 */
const findByUsername = async (db, username) => {
  const [rows] = await db.execute(
    `SELECT 
      u.u_id,
      u.br_id,
      u.r_id,
      u.reports_to,
      u.username,
      u.password_hash,
      u.email,
      u.is_active,
      u.is_online,
      u.last_login_at,
      u.failed_login_attempts,
      u.locked_until,
      u.device_token,
      u.device_platform,
      r.name AS role_name,
      r.slug AS role_slug,
      r.level AS role_level,
      b.name AS branch_name
    FROM users u
    LEFT JOIN roles r ON u.r_id = r.r_id
    LEFT JOIN branches b ON u.br_id = b.br_id
    WHERE u.username = ?
    LIMIT 1`,
    [username]
  );
  return rows[0] || null;
};

/**
 * Find user by ID
 */
const findById = async (db, userId) => {
  const [rows] = await db.execute(
    `SELECT 
      u.u_id,
      u.br_id,
      u.r_id,
      u.reports_to,
      u.username,
      u.email,
      u.is_active,
      u.is_online,
      u.last_login_at,
      u.device_token,
      u.device_platform,
      r.name AS role_name,
      r.slug AS role_slug,
      r.level AS role_level,
      b.name AS branch_name,
      up.first_name,
      up.last_name,
      up.phone,
      up.phone_code,
      up.profile_image,
      up.designation,
      up.department,
      up.gender,
      up.date_of_birth,
      up.join_date,
      up.personal_email
    FROM users u
    LEFT JOIN roles r ON u.r_id = r.r_id
    LEFT JOIN branches b ON u.br_id = b.br_id
    LEFT JOIN user_profiles up ON u.u_id = up.u_id
    WHERE u.u_id = ?
    LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Update last login info
 */
const updateLastLogin = async (db, userId, ip) => {
  await db.execute(
    `UPDATE users 
     SET last_login_at = NOW(), 
         last_login_ip = ?,
         is_online = 1,
         failed_login_attempts = 0,
         locked_until = NULL
     WHERE u_id = ?`,
    [ip, userId]
  );
};

/**
 * Increment failed login attempts
 */
const incrementFailedAttempts = async (db, userId) => {
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  const lockMinutes = parseInt(process.env.LOCK_DURATION_MINUTES || '30');

  await db.execute(
    `UPDATE users 
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE 
           WHEN failed_login_attempts + 1 >= ? 
           THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
           ELSE locked_until 
         END
     WHERE u_id = ?`,
    [maxAttempts, lockMinutes, userId]
  );
};

/**
 * Update device token (for push notifications)
 */
const updateDeviceToken = async (db, userId, deviceToken, platform) => {
  await db.execute(
    `UPDATE users 
     SET device_token = ?, device_platform = ?
     WHERE u_id = ?`,
    [deviceToken, platform, userId]
  );
};

/**
 * Set user offline
 */
const setOffline = async (db, userId) => {
  await db.execute(
    `UPDATE users SET is_online = 0 WHERE u_id = ?`,
    [userId]
  );
};

/**
 * Get user permissions (role defaults + per-user overrides)
 */
const getUserPermissions = async (db, userId) => {
  // Compute permissions directly from role_permissions + user_permissions overrides
  // (instead of relying on v_user_permissions view which may be stale)
  const [rows] = await db.execute(
    `SELECT
       p.code AS permission_code,
       p.module,
       p.action,
       COALESCE(up.granted, CASE WHEN rp.p_id IS NOT NULL THEN 1 ELSE 0 END) AS has_permission,
       CASE WHEN up.granted IS NOT NULL THEN 'user' ELSE 'role' END AS source
     FROM permissions p
     LEFT JOIN users u ON u.u_id = ?
     LEFT JOIN role_permissions rp ON rp.p_id = p.p_id AND rp.r_id = u.r_id
     LEFT JOIN user_permissions up ON up.p_id = p.p_id AND up.u_id = ?
     HAVING has_permission = 1`,
    [userId, userId]
  );
  return rows;
};

/**
 * Get CRM settings
 */
const getCrmSettings = async (db) => {
  const [rows] = await db.execute(
    `SELECT * FROM crm_settings WHERE is_active = 1 LIMIT 1`
  );
  return rows[0] || null;
};

/**
 * Log login attempt
 */
const logLoginAttempt = async (db, data) => {
  await db.execute(
    `INSERT INTO login_history 
      (u_id, username_input, status, ip_address, user_agent, device_platform)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.userId || null,
      data.usernameInput,
      data.status,
      data.ipAddress || null,
      data.userAgent || null,
      data.devicePlatform || null,
    ]
  );
};

/**
 * Store refresh token
 */
const storeRefreshToken = async (db, data) => {
  await db.execute(
    `INSERT INTO refresh_tokens 
      (u_id, token_hash, device_name, device_platform, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      data.tokenHash,
      data.deviceName || null,
      data.devicePlatform || null,
      data.ipAddress || null,
      data.expiresAt,
    ]
  );
};

/**
 * Find valid refresh token
 */
const findRefreshToken = async (db, tokenHash, userId) => {
  const [rows] = await db.execute(
    `SELECT * FROM refresh_tokens 
     WHERE token_hash = ? 
       AND u_id = ?
       AND is_revoked = 0 
       AND expires_at > NOW()
     LIMIT 1`,
    [tokenHash, userId]
  );
  return rows[0] || null;
};

/**
 * Revoke a specific refresh token
 */
const revokeRefreshToken = async (db, tokenHash) => {
  await db.execute(
    `UPDATE refresh_tokens SET is_revoked = 1 WHERE token_hash = ?`,
    [tokenHash]
  );
};

/**
 * Revoke all refresh tokens for a user (logout from all devices)
 */
const revokeAllUserTokens = async (db, userId) => {
  await db.execute(
    `UPDATE refresh_tokens SET is_revoked = 1 WHERE u_id = ?`,
    [userId]
  );
};

/**
 * Change password
 */
const updatePassword = async (db, userId, newPasswordHash) => {
  await db.execute(
    `UPDATE users 
     SET password_hash = ?, 
         password_changed_at = NOW()
     WHERE u_id = ?`,
    [newPasswordHash, userId]
  );
};

module.exports = {
  findByUsername,
  findById,
  updateLastLogin,
  incrementFailedAttempts,
  updateDeviceToken,
  setOffline,
  getUserPermissions,
  getCrmSettings,
  logLoginAttempt,
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  updatePassword,
};
