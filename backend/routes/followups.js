const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const followupController = require('../controllers/followupController');

router.use(authenticate);
router.get('/', followupController.getFollowups);

module.exports = router;
