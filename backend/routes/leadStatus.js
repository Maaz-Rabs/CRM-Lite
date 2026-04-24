// ============================================================================
// LEAD STATUS ROUTES
// /api/lead-statuses
// ============================================================================

const express = require('express');
const router = express.Router();
const leadStatusController = require('../controllers/leadStatusController');
const { authenticate, requireLevel } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ─── GET ROUTES ──────────────────────────────────────────────────────────────

// GET /api/lead-statuses - Get all active statuses
router.get('/', leadStatusController.getAll);

// GET /api/lead-statuses/all - Get all statuses including inactive (admin only)
router.get('/all', requireLevel(2), leadStatusController.getAllAdmin);

// GET /api/lead-statuses/:id - Get single status
router.get('/:id', leadStatusController.getById);

// ─── POST ROUTES ─────────────────────────────────────────────────────────────

// POST /api/lead-statuses - Create new status (admin only, level 1-2)
router.post('/', requireLevel(2), leadStatusController.create);

// ─── PUT ROUTES ──────────────────────────────────────────────────────────────

// PUT /api/lead-statuses/reorder - Reorder statuses (admin only)
router.put('/reorder', requireLevel(2), leadStatusController.reorder);

// PUT /api/lead-statuses/:id - Update status (admin only)
router.put('/:id', requireLevel(2), leadStatusController.update);

// ─── DELETE ROUTES ───────────────────────────────────────────────────────────

// DELETE /api/lead-statuses/:id - Delete status (admin only)
router.delete('/:id', requireLevel(2), leadStatusController.remove);

module.exports = router;
