/**
 * Dynamic Fields Routes
 * Mounted at /api/dynamic-fields
 */

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dynamicFieldsController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// Read: any authenticated user
router.get('/:type', ctrl.list);

// Write: admin/master only
const adminOnly = requireRole('master', 'admin');

router.post('/:type', adminOnly, ctrl.create);
router.put('/:type/:id', adminOnly, ctrl.update);
router.delete('/:type/:id', adminOnly, ctrl.remove);
router.patch('/:type/:id/toggle', adminOnly, ctrl.toggle);

module.exports = router;
