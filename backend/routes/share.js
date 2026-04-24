const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const { authenticate } = require('../middleware/auth');
const { resolveDatabase } = require('../middleware/dbResolver');

// ── Public route (no auth, needs DB resolution) ──
router.get('/shared/:token', resolveDatabase, shareController.getSharedContent);

// ── Protected routes (auth provides DB via token) ──
router.post('/', authenticate, shareController.createShareLink);
router.get('/:linkId/stats', authenticate, shareController.getShareStats);
router.delete('/:linkId', authenticate, shareController.deactivateLink);

module.exports = router;
