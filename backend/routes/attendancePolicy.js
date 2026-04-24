// ============================================================================
// ATTENDANCE POLICY ROUTES
// /api/attendance-policies
// ============================================================================

const express = require('express');
const router = express.Router();
const controller = require('../controllers/attendancePolicyController');
const { authenticate, requireLevel } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/attendance-policies - Get all active policies
router.get('/', controller.getAll);

// GET /api/attendance-policies/:id/user-week-offs - Get per-user week offs
router.get('/:id/user-week-offs', controller.getUserWeekOffs);

// POST /api/attendance-policies - Create new policy (admin only)
router.post('/', requireLevel(2), controller.create);

// PUT /api/attendance-policies/:id - Update policy (admin only)
router.put('/:id', requireLevel(2), controller.update);

// DELETE /api/attendance-policies/:id - Delete policy (admin only)
router.delete('/:id', requireLevel(2), controller.remove);

module.exports = router;
