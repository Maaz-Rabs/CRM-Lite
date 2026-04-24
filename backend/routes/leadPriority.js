// ============================================================================
// LEAD PRIORITY ROUTES
// /api/lead-priorities
// ============================================================================

const express = require('express');
const router = express.Router();
const leadPriorityController = require('../controllers/leadPriorityController');
const { authenticate, requireLevel } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// GET /api/lead-priorities - Get all active priorities
router.get('/', leadPriorityController.getAll);

// GET /api/lead-priorities/all - Get all priorities including inactive (admin only)
router.get('/all', requireLevel(2), leadPriorityController.getAllAdmin);

// POST /api/lead-priorities - Create new priority (admin only)
router.post('/', requireLevel(2), leadPriorityController.create);

// PUT /api/lead-priorities/:id - Update priority (admin only)
router.put('/:id', requireLevel(2), leadPriorityController.update);

// DELETE /api/lead-priorities/:id - Delete priority (admin only)
router.delete('/:id', requireLevel(2), leadPriorityController.remove);

module.exports = router;
