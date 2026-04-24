// ============================================================================
// AUTH ROUTES
// POST /api/auth/login        → Login (public)
// POST /api/auth/refresh       → Refresh token (public)
// GET  /api/auth/me            → Get current user (protected)
// POST /api/auth/logout        → Logout (protected)
// POST /api/auth/logout-all    → Logout all devices (protected)
// POST /api/auth/change-password → Change password (protected)
// ============================================================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { resolveDatabase } = require('../middleware/dbResolver');

// ── Public routes (need DB resolution) ──
router.post('/login', resolveDatabase, authController.login);
router.post('/refresh', resolveDatabase, authController.refreshToken);
router.post('/forgot-password', resolveDatabase, authController.forgotPassword);
router.post('/verify-otp', resolveDatabase, authController.verifyOtp);
router.post('/reset-password', resolveDatabase, authController.resetPassword);
router.post('/reset-lock', resolveDatabase, authController.resetLock);

// ── Protected routes ──
router.get('/me', authenticate, authController.getMe);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/device-token', authenticate, authController.updateDeviceToken);
router.post('/impersonate', authenticate, authController.impersonate);

module.exports = router;
