/**
 * Attendance Routes
 */

const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticate, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get today's status
router.get('/today', attendanceController.getTodayStatus);

// Punch in
router.post('/punch-in', attendanceController.punchIn);

// Punch out
router.post('/punch-out', attendanceController.punchOut);

// Get history (own attendance)
router.get('/history', attendanceController.getHistory);

// Get monthly stats (own attendance)
router.get('/stats', attendanceController.getStats);

// ─── Admin-only routes ───────────────────────────────
const adminOnly = requireRole('master', 'admin');

router.get('/admin/daily', adminOnly, attendanceController.getAdminDaily);
router.get('/admin/monthly', adminOnly, attendanceController.getAdminMonthly);
router.get('/admin/user-detail', adminOnly, attendanceController.getAdminUserDetail);

module.exports = router;
