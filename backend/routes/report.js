const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.use(authenticate);

// GET /api/reports/users — list users with summary stats
router.get('/users', ctrl.getUsersList);

// GET /api/reports/users/:id — full report for a user
router.get('/users/:id', ctrl.getUserReport);

module.exports = router;
