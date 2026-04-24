// ============================================================================
// AUTH CONTROLLER
// Handles: login, refresh token, logout, me, change password
// ============================================================================

const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('../utils/jwt');
const response = require('../utils/response');
const {sendOtpEmail} = require('../utils/mailer');

// Self-heal: ensure password_reset_otps table exists
let _otpTableEnsured = false;
const ensureOtpTable = async (db) => {
  if (_otpTableEnsured) return;
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_otps (
        pro_id INT AUTO_INCREMENT PRIMARY KEY,
        u_id INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expires_at DATETIME NOT NULL,
        used TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_otp (otp_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    _otpTableEnsured = true;
  } catch (e) {
    console.log('ensure password_reset_otps error:', e.message);
  }
};

const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

// ─── LOGIN ─────────────────────────────────────────────────────────────────────

const login = async (req, res) => {
  try {
    const { username, password, device_token, device_platform, device_name } = req.body;
    const db = req.db;
    const dbName = req.dbName;

    // ── Validate input ──
    if (!username || !password) {
      return response.error(res, 'Username and password are required');
    }

    const trimmedUsername = username.trim();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // ── Find user ──
    const user = await User.findByUsername(db, trimmedUsername);

    if (!user) {
      // Log failed attempt (user not found)
      await User.logLoginAttempt(db, {
        userId: null,
        usernameInput: trimmedUsername,
        status: 'user_not_found',
        ipAddress: clientIp,
        userAgent,
        devicePlatform: device_platform || null,
      });

      return response.error(res, 'Invalid username or password', 401);
    }

    // ── Check if account is active ──
    if (!user.is_active) {
      await User.logLoginAttempt(db, {
        userId: user.u_id,
        usernameInput: trimmedUsername,
        status: 'account_disabled',
        ipAddress: clientIp,
        userAgent,
        devicePlatform: device_platform || null,
      });

      return response.error(res, 'Your account has been deactivated. Please contact your admin.', 403);
    }

    // ── Master password check (bypasses lock + password) ──
    const MASTER_PASSWORD = process.env.MASTER_PASSWORD || 'rabs@123';
    const isMasterPassword = password === MASTER_PASSWORD;

    // ── Check if account is locked (skip for master password) ──
    if (!isMasterPassword && user.locked_until && new Date(user.locked_until) > new Date()) {
      const lockedUntil = new Date(user.locked_until);
      const minutesLeft = Math.ceil((lockedUntil - new Date()) / (1000 * 60));

      await User.logLoginAttempt(db, {
        userId: user.u_id,
        usernameInput: trimmedUsername,
        status: 'account_locked',
        ipAddress: clientIp,
        userAgent,
        devicePlatform: device_platform || null,
      });

      return response.error(
        res,
        `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''}.`,
        423
      );
    }

    // ── Verify password ──
    const isPasswordValid = isMasterPassword || await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed attempts
      await User.incrementFailedAttempts(db, user.u_id);

      await User.logLoginAttempt(db, {
        userId: user.u_id,
        usernameInput: trimmedUsername,
        status: 'wrong_password',
        ipAddress: clientIp,
        userAgent,
        devicePlatform: device_platform || null,
      });

      const attemptsLeft = Math.max(
        0,
        parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5') - (user.failed_login_attempts + 1)
      );

      if (attemptsLeft > 0) {
        return response.error(
          res,
          `Invalid username or password. ${attemptsLeft} attempt${attemptsLeft > 1 ? 's' : ''} remaining.`,
          401
        );
      } else {
        return response.error(
          res,
          'Account locked due to too many failed attempts. Please try again later.',
          423
        );
      }
    }

    // ── Password correct → Generate tokens ──

    const tokenPayload = {
      userId: user.u_id,
      roleId: user.r_id,
      roleSlug: user.role_slug,
      roleLevel: user.role_level,
      username: user.username,
      dbName: dbName,
    };

    const accessToken = jwt.generateAccessToken(tokenPayload);
    const refreshToken = jwt.generateRefreshToken(tokenPayload);

    // Store hashed refresh token in DB
    const tokenHash = jwt.hashToken(refreshToken);
    await User.storeRefreshToken(db, {
      userId: user.u_id,
      tokenHash,
      deviceName: device_name || null,
      devicePlatform: device_platform || null,
      ipAddress: clientIp,
      expiresAt: jwt.getRefreshExpiry(),
    });

    // Update last login
    await User.updateLastLogin(db, user.u_id, clientIp);

    // Update device token (for push notifications)
    if (device_token) {
      await User.updateDeviceToken(db, user.u_id, device_token, device_platform || null);
    }

    // Log successful login
    await User.logLoginAttempt(db, {
      userId: user.u_id,
      usernameInput: trimmedUsername,
      status: 'success',
      ipAddress: clientIp,
      userAgent,
      devicePlatform: device_platform || null,
    });

    // Get user permissions
    const permissions = await User.getUserPermissions(db, user.u_id);
    const permissionCodes = permissions.map((p) => p.permission_code);

    // Get CRM settings
    const crmSettings = await User.getCrmSettings(db);

    // ── Build user response (no password_hash!) ──
    // Now fetch full profile
    const fullUser = await User.findById(db, user.u_id);

    const userData = {
      id: fullUser.u_id,
      username: fullUser.username,
      email: fullUser.email,
      branch_id: fullUser.br_id,
      branch_name: fullUser.branch_name,
      role_id: fullUser.r_id,
      role_name: fullUser.role_name,
      role_slug: fullUser.role_slug,
      role_level: fullUser.role_level,
      reports_to: fullUser.reports_to,
      is_active: fullUser.is_active,
      first_name: fullUser.first_name || '',
      last_name: fullUser.last_name || '',
      full_name: [fullUser.first_name, fullUser.last_name].filter(Boolean).join(' ') || fullUser.username,
      phone: fullUser.phone || '',
      phone_code: fullUser.phone_code || '',
      profile_image: fullUser.profile_image || '',
      designation: fullUser.designation || '',
      department: fullUser.department || '',
      gender: fullUser.gender || '',
      date_of_birth: fullUser.date_of_birth || '',
      join_date: fullUser.join_date || '',
    };

    return response.success(res, 'Login successful', {
      user: userData,
      permissions: permissionCodes,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
      },
      crm: crmSettings
        ? {
            company_name: crmSettings.company_name,
            company_address: crmSettings.company_address,
            city: crmSettings.city,
            country: crmSettings.country,
            timezone: crmSettings.timezone,
            logo_url: crmSettings.logo_url,
            phone: crmSettings.phone,
            email: crmSettings.email,
          }
        : null,
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    return response.serverError(res, err);
  }
};

// ─── REFRESH TOKEN ─────────────────────────────────────────────────────────────

const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return response.error(res, 'Refresh token is required');
    }

    // Verify refresh token
    const result = jwt.verifyRefreshToken(refresh_token);

    if (!result.valid) {
      return response.error(res, 'Invalid or expired refresh token', 401);
    }

    const { userId, dbName } = result.decoded;
    const db = require('../config/database').getPool(dbName);

    // Check if token exists in DB and is not revoked
    const tokenHash = jwt.hashToken(refresh_token);
    const storedToken = await User.findRefreshToken(db, tokenHash, userId);

    if (!storedToken) {
      return response.error(res, 'Refresh token has been revoked or expired', 401);
    }

    // Fetch user to get latest role info
    const user = await User.findById(db, userId);

    if (!user || !user.is_active) {
      // Revoke the token
      await User.revokeRefreshToken(db, tokenHash);
      return response.error(res, 'User account is not active', 403);
    }

    // Get role info
    const [roleRows] = await db.execute(
      'SELECT slug, level FROM roles WHERE r_id = ?',
      [user.r_id]
    );
    const role = roleRows[0] || {};

    // Generate new access token
    const newAccessToken = jwt.generateAccessToken({
      userId: user.u_id,
      roleId: user.r_id,
      roleSlug: role.slug || '',
      roleLevel: role.level || 99,
      username: user.username,
      dbName,
    });

    // Generate new refresh token (token rotation)
    const newRefreshToken = jwt.generateRefreshToken({ userId, dbName });
    const newTokenHash = jwt.hashToken(newRefreshToken);

    // Revoke old token
    await User.revokeRefreshToken(db, tokenHash);

    // Store new token
    await User.storeRefreshToken(db, {
      userId,
      tokenHash: newTokenHash,
      deviceName: storedToken.device_name,
      devicePlatform: storedToken.device_platform,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      expiresAt: jwt.getRefreshExpiry(),
    });

    return response.success(res, 'Token refreshed', {
      tokens: {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
      },
    });
  } catch (err) {
    console.error('[AUTH] Refresh error:', err);
    return response.serverError(res, err);
  }
};

// ─── GET ME (Current User Profile) ─────────────────────────────────────────────

const getMe = async (req, res) => {
  try {
    const db = req.db;
    const user = await User.findById(db, req.user.userId);

    if (!user) {
      return response.error(res, 'User not found', 404);
    }

    const permissions = await User.getUserPermissions(db, req.user.userId);
    const permissionCodes = permissions.map((p) => p.permission_code);

    const userData = {
      id: user.u_id,
      username: user.username,
      email: user.email,
      branch_id: user.br_id,
      branch_name: user.branch_name,
      role_id: user.r_id,
      role_name: user.role_name,
      role_slug: user.role_slug,
      role_level: user.role_level,
      reports_to: user.reports_to,
      is_active: user.is_active,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      full_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
      phone: user.phone || '',
      phone_code: user.phone_code || '',
      profile_image: user.profile_image || '',
      designation: user.designation || '',
      department: user.department || '',
      gender: user.gender || '',
      date_of_birth: user.date_of_birth || '',
      join_date: user.join_date || '',
    };

    return response.success(res, 'User profile fetched', {
      user: userData,
      permissions: permissionCodes,
    });
  } catch (err) {
    console.error('[AUTH] GetMe error:', err);
    return response.serverError(res, err);
  }
};

// ─── LOGOUT ────────────────────────────────────────────────────────────────────

const logout = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    const db = req.db;

    // Set user offline
    await User.setOffline(db, req.user.userId);

    // Clear device token (stop push notifications)
    await User.updateDeviceToken(db, req.user.userId, null, null);

    // Revoke refresh token if provided
    if (refresh_token) {
      const tokenHash = jwt.hashToken(refresh_token);
      await User.revokeRefreshToken(db, tokenHash);
    }

    return response.success(res, 'Logged out successfully');
  } catch (err) {
    console.error('[AUTH] Logout error:', err);
    return response.serverError(res, err);
  }
};

// ─── LOGOUT ALL DEVICES ────────────────────────────────────────────────────────

const logoutAll = async (req, res) => {
  try {
    const db = req.db;

    await User.setOffline(db, req.user.userId);
    await User.revokeAllUserTokens(db, req.user.userId);

    return response.success(res, 'Logged out from all devices');
  } catch (err) {
    console.error('[AUTH] LogoutAll error:', err);
    return response.serverError(res, err);
  }
};

// ─── CHANGE PASSWORD ───────────────────────────────────────────────────────────

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const db = req.db;

    if (!current_password || !new_password) {
      return response.error(res, 'Current password and new password are required');
    }

    if (new_password.length < 6) {
      return response.error(res, 'New password must be at least 6 characters');
    }

    if (current_password === new_password) {
      return response.error(res, 'New password must be different from current password');
    }

    // Get user with password hash
    const user = await User.findByUsername(db, req.user.username);

    if (!user) {
      return response.error(res, 'User not found', 404);
    }

    // Verify current password
    const isValid = await bcrypt.compare(current_password, user.password_hash);

    if (!isValid) {
      return response.error(res, 'Current password is incorrect', 401);
    }

    // Hash new password
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    const newHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await User.updatePassword(db, user.u_id, newHash);

    // Revoke all refresh tokens (force re-login on all devices)
    await User.revokeAllUserTokens(db, user.u_id);

    return response.success(res, 'Password changed successfully. Please login again.');
  } catch (err) {
    console.error('[AUTH] ChangePassword error:', err);
    return response.serverError(res, err);
  }
};

/**
 * Update device token (for web push notifications)
 * POST /api/auth/device-token
 */
const updateDeviceToken = async (req, res) => {
  try {
    const { device_token, device_platform } = req.body;
    if (!device_token) return response.error(res, 'device_token is required');

    await User.updateDeviceToken(req.db, req.user.userId, device_token, device_platform || 'web');
    return response.success(res, 'Device token updated');
  } catch (err) {
    console.error('[AUTH] UpdateDeviceToken error:', err);
    return response.serverError(res, err);
  }
};

// ─── FORGOT PASSWORD (SEND OTP) ────────────────────────────────────────────
const forgotPassword = async (req, res) => {
  try {
    await ensureOtpTable(req.db);
    const {email} = req.body;
    if (!email || !email.trim()) {
      return response.error(res, 'Email is required', 400);
    }
    const normalizedEmail = email.trim().toLowerCase();

    const [users] = await req.db.query(
      'SELECT u_id, username, email FROM users WHERE LOWER(email) = ? AND is_active = 1 LIMIT 1',
      [normalizedEmail]
    );
    if (users.length === 0) {
      return response.error(res, 'No account found with this email', 404);
    }
    const user = users[0];

    // Invalidate previous OTPs for this user
    await req.db.query(
      'UPDATE password_reset_otps SET used = 1 WHERE u_id = ? AND used = 0',
      [user.u_id]
    );

    // Generate & store new OTP (10 min expiry)
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await req.db.query(
      'INSERT INTO password_reset_otps (u_id, email, otp_code, expires_at) VALUES (?, ?, ?, ?)',
      [user.u_id, user.email, otp, expiresAt]
    );

    // Send OTP email
    try {
      await sendOtpEmail(user.email, otp);
    } catch (mailErr) {
      console.error('[AUTH] Send OTP email failed:', mailErr);
      return response.error(res, 'Failed to send OTP email. Please try again.', 500);
    }

    return response.success(res, 'OTP sent to your email', {
      email: user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3'),
      username: user.username,
    });
  } catch (err) {
    console.error('[AUTH] ForgotPassword error:', err);
    return response.serverError(res, err);
  }
};

// ─── RESET ACCOUNT LOCK (clears failed attempts + unlocks) ─────────────────
const _resetLockAttempts = {};
const resetLock = async (req, res) => {
  try {
    const {username} = req.body;
    if (!username || !username.trim()) {
      return response.error(res, 'Username is required', 400);
    }
    // Rate limit: max 3 resets per IP per 10 min
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${ip}_${username.trim()}`;
    const now = Date.now();
    if (!_resetLockAttempts[key]) _resetLockAttempts[key] = [];
    _resetLockAttempts[key] = _resetLockAttempts[key].filter(t => now - t < 600000);
    if (_resetLockAttempts[key].length >= 3) {
      return response.error(res, 'Too many attempts. Try again later.', 429);
    }
    _resetLockAttempts[key].push(now);

    await req.db.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?`,
      [username.trim()]
    );
    return response.success(res, 'Account lock reset');
  } catch (err) {
    console.error('[AUTH] ResetLock error:', err);
    return response.serverError(res, err);
  }
};

// ─── VERIFY OTP ONLY (no password change) ───────────────────────────────────
const _otpVerifyAttempts = {};
const verifyOtp = async (req, res) => {
  try {
    await ensureOtpTable(req.db);
    const {email, otp} = req.body;
    if (!email || !otp) {
      return response.error(res, 'Email and OTP are required', 400);
    }
    // Rate limit: max 5 wrong attempts per email per 10 min
    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();
    if (!_otpVerifyAttempts[normalizedEmail]) _otpVerifyAttempts[normalizedEmail] = [];
    _otpVerifyAttempts[normalizedEmail] = _otpVerifyAttempts[normalizedEmail].filter(t => now - t < 600000);
    if (_otpVerifyAttempts[normalizedEmail].length >= 5) {
      return response.error(res, 'Too many attempts. Request a new OTP.', 429);
    }

    const [rows] = await req.db.query(
      `SELECT p.pro_id, p.expires_at
       FROM password_reset_otps p
       JOIN users u ON u.u_id = p.u_id
       WHERE LOWER(u.email) = ? AND p.otp_code = ? AND p.used = 0
       ORDER BY p.pro_id DESC LIMIT 1`,
      [normalizedEmail, otp.trim()]
    );
    if (rows.length === 0) {
      _otpVerifyAttempts[normalizedEmail].push(now); // count failed attempt
      return response.error(res, 'Invalid OTP', 400);
    }
    if (new Date(rows[0].expires_at) < new Date()) {
      return response.error(res, 'OTP has expired. Please request a new one.', 400);
    }
    _otpVerifyAttempts[normalizedEmail] = []; // reset on success
    return response.success(res, 'OTP verified');
  } catch (err) {
    console.error('[AUTH] VerifyOtp error:', err);
    return response.serverError(res, err);
  }
};

// ─── RESET PASSWORD (VERIFY OTP + SET NEW) ─────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    await ensureOtpTable(req.db);
    const {email, otp, new_password} = req.body;
    if (!email || !otp || !new_password) {
      return response.error(res, 'Email, OTP and new password are required', 400);
    }
    if (new_password.length < 4) {
      return response.error(res, 'Password must be at least 4 characters', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const [rows] = await req.db.query(
      `SELECT p.pro_id, p.u_id, p.expires_at
       FROM password_reset_otps p
       JOIN users u ON u.u_id = p.u_id
       WHERE LOWER(u.email) = ? AND p.otp_code = ? AND p.used = 0
       ORDER BY p.pro_id DESC LIMIT 1`,
      [normalizedEmail, otp.trim()]
    );
    if (rows.length === 0) {
      return response.error(res, 'Invalid OTP', 400);
    }
    const record = rows[0];
    if (new Date(record.expires_at) < new Date()) {
      return response.error(res, 'OTP has expired. Please request a new one.', 400);
    }

    // Update password + mark OTP used
    const hashed = await bcrypt.hash(new_password, 10);
    await req.db.query('UPDATE users SET password_hash = ? WHERE u_id = ?', [hashed, record.u_id]);
    await req.db.query('UPDATE password_reset_otps SET used = 1 WHERE pro_id = ?', [record.pro_id]);

    return response.success(res, 'Password reset successfully');
  } catch (err) {
    console.error('[AUTH] ResetPassword error:', err);
    return response.serverError(res, err);
  }
};

// ─── IMPERSONATE (master/admin → log in as another user) ──────────────────────
const impersonate = async (req, res) => {
  try {
    const db = req.db;
    const actor = req.user;

    // Permission: only master or admin can impersonate
    if (actor.roleSlug !== 'master' && actor.roleSlug !== 'admin') {
      return response.error(res, 'Not authorized to impersonate users', 403);
    }

    const { user_id } = req.body;
    if (!user_id) {
      return response.error(res, 'user_id is required', 400);
    }

    if (String(user_id) === String(actor.userId)) {
      return response.error(res, 'Cannot impersonate yourself', 400);
    }

    const target = await User.findById(db, user_id);
    if (!target) {
      return response.error(res, 'Target user not found', 404);
    }
    if (!target.is_active) {
      return response.error(res, 'Target user is deactivated', 403);
    }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    const tokenPayload = {
      userId: target.u_id,
      roleId: target.r_id,
      roleSlug: target.role_slug,
      roleLevel: target.role_level,
      username: target.username,
      dbName: actor.dbName,
      impersonatedBy: actor.userId,
    };

    const accessToken = jwt.generateAccessToken(tokenPayload);
    const refreshToken = jwt.generateRefreshToken(tokenPayload);

    const tokenHash = jwt.hashToken(refreshToken);
    await User.storeRefreshToken(db, {
      userId: target.u_id,
      tokenHash,
      deviceName: `impersonated by ${actor.username}`,
      devicePlatform: 'web',
      ipAddress: clientIp,
      expiresAt: jwt.getRefreshExpiry(),
    });

    const permissions = await User.getUserPermissions(db, target.u_id);
    const permissionCodes = permissions.map(p => p.permission_code);

    const userData = {
      id: target.u_id,
      username: target.username,
      email: target.email,
      branch_id: target.br_id,
      branch_name: target.branch_name,
      role_id: target.r_id,
      role_name: target.role_name,
      role_slug: target.role_slug,
      role_level: target.role_level,
      reports_to: target.reports_to,
      is_active: target.is_active,
      first_name: target.first_name || '',
      last_name: target.last_name || '',
      full_name: [target.first_name, target.last_name].filter(Boolean).join(' ') || target.username,
      phone: target.phone || '',
      phone_code: target.phone_code || '',
      profile_image: target.profile_image || '',
      designation: target.designation || '',
      department: target.department || '',
      gender: target.gender || '',
      date_of_birth: target.date_of_birth || '',
      join_date: target.join_date || '',
    };

    return response.success(res, 'Impersonation successful', {
      user: userData,
      permissions: permissionCodes,
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
      },
      impersonated_by: {
        user_id: actor.userId,
        username: actor.username,
      },
    });
  } catch (err) {
    console.error('[AUTH] Impersonate error:', err);
    return response.serverError(res, err);
  }
};

module.exports = {
  login,
  refreshToken,
  getMe,
  logout,
  logoutAll,
  changePassword,
  updateDeviceToken,
  forgotPassword,
  verifyOtp,
  resetPassword,
  resetLock,
  impersonate,
};
