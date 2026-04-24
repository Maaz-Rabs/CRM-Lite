const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/notificationController');

router.use(authenticate);

// GET /api/notifications — list all
router.get('/', ctrl.getAll);

// GET /api/notifications/unread-count — badge count
router.get('/unread-count', ctrl.getUnreadCount);

// PUT /api/notifications/read-all — mark all read
router.put('/read-all', ctrl.markAllRead);

// PUT /api/notifications/:id/read — mark one read
router.put('/:id/read', ctrl.markRead);

// DELETE /api/notifications/:id — delete one
router.delete('/:id', ctrl.remove);

// DELETE /api/notifications — clear all
router.delete('/', ctrl.removeAll);

module.exports = router;
