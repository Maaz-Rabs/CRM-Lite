const express = require('express');
const router = express.Router();
const controller = require('../controllers/reminderSettingsController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, controller.getAll);
router.post('/', authenticate, controller.create);
router.patch('/:id/toggle', authenticate, controller.toggle);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
