const express = require('express');
const router = express.Router();
const propertyController = require('../controllers/propertyController');
const { authenticate } = require('../middleware/auth');
const { uploadPropertyMedia, handleUploadError } = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Stats route (must be before :id route)
router.get('/stats', propertyController.getStats);

// CRUD operations
router.get('/', propertyController.getAll);
router.post('/', propertyController.create);
router.get('/:id', propertyController.getById);
router.put('/:id', propertyController.update);
router.delete('/:id', propertyController.remove);

// Media routes
router.post('/:id/media', uploadPropertyMedia, handleUploadError, propertyController.uploadMedia);
router.delete('/:id/media/:mediaId', propertyController.deleteMedia);

// History route
router.get('/:id/history', propertyController.getHistory);

module.exports = router;
