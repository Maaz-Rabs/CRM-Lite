const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/candidateOptionsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/:type', ctrl.getAll);
router.post('/:type', ctrl.create);
router.put('/:type/:id', ctrl.update);
router.delete('/:type/:id', ctrl.remove);

module.exports = router;
