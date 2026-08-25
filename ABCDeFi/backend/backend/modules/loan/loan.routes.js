const express = require('express');
const router = express.Router();
const auth = require('../../middleware/authMiddleware');
const loanController = require('./loan.controller');

// POST /api/loans/preview - Preview loan calculations (no auth required technically, but good to have)
router.post('/preview', auth, loanController.previewLoan);

// POST /api/loans/request - Request a new loan
router.post('/request', auth, loanController.requestLoan);

// Public P2P Loan Marketplace Browsing (No Auth required for viewing listings)
router.get('/marketplace', loanController.getUserLoans);
router.get('/all', loanController.getUserLoans);

// GET /api/loans - Get all loans for current user
router.get('/', auth, loanController.getUserLoans);

module.exports = router;
