const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');

// All dashboard routes require authentication
router.use(authenticate);

// GET /api/dashboard/summary
router.get('/summary', dashboardController.getSummary);

// GET /api/dashboard/project-leads/:id?ls_id=optional
router.get('/project-leads/:id', dashboardController.getProjectLeads);

// GET /api/dashboard/source-leads/:source
router.get('/source-leads/:source', dashboardController.getSourceLeads);

module.exports = router;
