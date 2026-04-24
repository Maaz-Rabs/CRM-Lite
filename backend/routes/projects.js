const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const towerController = require('../controllers/towerController');
const timelineController = require('../controllers/timelineController');
const { authenticate } = require('../middleware/auth');
const { uploadProjectMedia, handleUploadError } = require('../middleware/upload');

// All project routes require authentication
router.use(authenticate);

// GET /api/projects - list all projects (with optional ?search=)
router.get('/', projectController.getAll);

// POST /api/projects - create project
router.post('/', projectController.create);

// GET /api/projects/:id - get single project
router.get('/:id', projectController.getById);

// PUT /api/projects/:id - update project
router.put('/:id', projectController.update);

// DELETE /api/projects/:id - soft delete project
router.delete('/:id', projectController.remove);

// PATCH /api/projects/:id/toggle - toggle is_active
router.patch('/:id/toggle', projectController.toggle);

// Media routes
router.post('/:id/media', uploadProjectMedia, handleUploadError, projectController.uploadMedia);
router.delete('/:id/media/:mediaId', projectController.deleteMedia);
router.patch('/:id/media/:mediaId/cover', projectController.setCoverImage);

// Stats and inventory
router.get('/:id/stats', projectController.getStats);
router.get('/:id/inventory', projectController.getInventory);

// Tower routes
router.get('/:id/towers', towerController.getAll);
router.post('/:id/towers', towerController.create);
router.put('/:id/towers/:towerId', towerController.update);
router.delete('/:id/towers/:towerId', towerController.remove);

// Timeline routes
router.get('/:id/timeline', timelineController.getAll);
router.post('/:id/timeline', timelineController.create);
router.put('/:id/timeline/:timelineId', timelineController.update);
router.delete('/:id/timeline/:timelineId', timelineController.remove);

module.exports = router;
