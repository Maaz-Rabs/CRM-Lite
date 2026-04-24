/**
 * Lead Routes
 * All lead-related API endpoints
 */

const express = require('express');
const router = express.Router();
const leadController = require('../controllers/leadController');
const { authenticate } = require('../middleware/auth');
const { uploadDocument, handleUploadError } = require('../middleware/upload');

// All routes require authentication
router.use(authenticate);

// Master data (must be before :id route)
router.get('/master-data', leadController.getMasterData);
router.get('/sources', leadController.getSources);
router.get('/priorities', leadController.getPriorities);
router.get('/users', leadController.getUsers);
router.get('/category-counts', leadController.getCategoryCounts);

// Import (must be before :id route)
router.post('/import', leadController.importLeads);

// CRUD operations
router.post('/', leadController.createLead);
router.get('/', leadController.getLeads);
router.get('/:id', leadController.getLead);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);

// Lead actions
router.patch('/:id/status', leadController.updateStatus);
router.patch('/:id/priority', leadController.updatePriority);
router.post('/:id/comments', leadController.addComment);
router.post('/:id/followup', leadController.addFollowup);
router.delete('/:id/followup', leadController.removeFollowup);
router.patch('/:id/lock', leadController.toggleLock);
router.post('/:id/assign', leadController.assignLead);
router.post('/:id/unassign', leadController.unassignLead);
router.post('/:id/call-activity', leadController.logCallActivity);
router.post('/:id/upload-document', uploadDocument.single('document'), handleUploadError, leadController.uploadDocument);

module.exports = router;
