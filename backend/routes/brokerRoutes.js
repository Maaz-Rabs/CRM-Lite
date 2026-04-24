const express = require('express');
const router = express.Router();
const brokerController = require('../controllers/brokerController');
const { authenticate, requireLevel } = require('../middleware/auth');
const { uploadBrokerFiles, uploadDocument, handleUploadError } = require('../middleware/upload');
const { createBrokerValidation, updateBrokerValidation } = require('../middleware/validation');

// Check if user has a specific permission code
const requirePermission = (...codes) => {
  return async (req, res, next) => {
    // Master/Admin bypass
    if (req.user.roleLevel <= 2) return next();

    // Check user permissions from DB
    try {
      const [perms] = await req.db.query(
        `SELECT p.code FROM user_permissions up
         JOIN permissions p ON up.p_id = p.p_id
         WHERE up.u_id = ? AND up.granted = 1`,
        [req.user.userId]
      );
      const userPerms = perms.map(p => p.code);

      // Also check role-level permissions
      const [rolePerms] = await req.db.query(
        `SELECT p.code FROM role_permissions rp
         JOIN permissions p ON rp.p_id = p.p_id
         WHERE rp.r_id = ?`,
        [req.user.roleId]
      );
      const allPerms = [...new Set([...userPerms, ...rolePerms.map(p => p.code)])];

      const hasAny = codes.some(c => allPerms.includes(c));
      if (!hasAny) {
        return res.status(403).json({ success: false, message: 'You do not have permission for this action' });
      }
      next();
    } catch (err) {
      // If permission tables don't exist, allow (fallback)
      next();
    }
  };
};

// All broker routes require authentication
router.use(authenticate);

// Get all brokers with pagination and filters
// GET /api/brokers?page=1&limit=20&search=&status=&specialization=&sortBy=&sortOrder=
router.get('/', brokerController.getAllBrokers);

// Get broker statistics
// GET /api/brokers/stats
router.get('/stats', brokerController.getBrokerStats);

// Get single broker by ID
// GET /api/brokers/:id
router.get('/:id', brokerController.getBrokerById);

// Create new broker
// POST /api/brokers
router.post(
  '/',
  requirePermission('broker_add'),
  uploadBrokerFiles,
  handleUploadError,
  createBrokerValidation,
  brokerController.createBroker
);

// Update broker
// PUT /api/brokers/:id
router.put(
  '/:id',
  requirePermission('broker_edit'),
  uploadBrokerFiles,
  handleUploadError,
  updateBrokerValidation,
  brokerController.updateBroker
);

// Delete broker (soft delete)
// DELETE /api/brokers/:id
router.delete('/:id', requirePermission('broker_delete'), brokerController.deleteBroker);

// Update broker status
// PATCH /api/brokers/:id/status
router.patch('/:id/status', brokerController.updateBrokerStatus);

// Get broker notes
// GET /api/brokers/:id/notes
router.get('/:id/notes', brokerController.getBrokerNotes);

// Add broker note
// POST /api/brokers/:id/notes
router.post('/:id/notes', brokerController.addBrokerNote);

// Delete broker note
// DELETE /api/brokers/notes/:noteId
router.delete('/notes/:noteId', brokerController.deleteBrokerNote);

// Upload additional document for broker
// POST /api/brokers/:id/documents
router.post(
  '/:id/documents',
  uploadDocument.single('document'),
  handleUploadError,
  brokerController.uploadDocument
);

// Delete broker document
// DELETE /api/brokers/documents/:documentId
router.delete('/documents/:documentId', brokerController.deleteDocument);

module.exports = router;
