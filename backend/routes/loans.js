const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication (also sets req.db per-tenant)
router.use(authenticate);

// Stats (must be before :id route)
router.get('/stats', loanController.getLoanStats);

// CRUD
router.get('/', loanController.getAllLoans);
router.post('/', loanController.createLoan);
router.get('/:id', loanController.getLoanById);
router.put('/:id', loanController.updateLoan);
router.delete('/:id', loanController.deleteLoan);

module.exports = router;
