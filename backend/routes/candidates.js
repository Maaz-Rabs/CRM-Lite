const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidateController');
const { authenticate } = require('../middleware/auth');
const { uploadDocument, handleUploadError } = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// GET /api/candidates - List all candidates
router.get('/', candidateController.getAll);

// POST /api/candidates - Create candidate
router.post('/', candidateController.create);

// GET /api/candidates/:id - Get single candidate
router.get('/:id', candidateController.getById);

// PUT /api/candidates/:id - Update candidate
router.put('/:id', candidateController.update);

// DELETE /api/candidates/:id - Soft delete candidate
router.delete('/:id', candidateController.remove);

// POST /api/candidates/:id/cv - Upload CV
router.post(
  '/:id/cv',
  uploadDocument.single('cv'),
  handleUploadError,
  candidateController.uploadCV
);

module.exports = router;
