const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payslipController');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// Read: any authenticated user (list is auto-scoped; single is owner or admin)
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

// Write: admin/master only
const adminOnly = requireRole('master', 'admin');
router.post('/', adminOnly, ctrl.create);
router.put('/:id', adminOnly, ctrl.update);
router.delete('/:id', adminOnly, ctrl.remove);

module.exports = router;
