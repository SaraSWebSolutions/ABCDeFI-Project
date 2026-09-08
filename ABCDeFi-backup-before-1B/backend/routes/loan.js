import express from 'express';
import workflow from '../services/lendingWorkflow.cjs';

const router = express.Router();
const { createLoanRequest, getLoanHistory, payEmi } = workflow;

/**
 * Phase 3 — Loan & EMI APIs
 * POST /loan/create
 * GET /loan/history
 * POST /loan/pay-emi
 */

router.post('/create', (req, res) => {
  try {
    const loan = createLoanRequest(req.body);
    res.json({
      success: true,
      message: 'Loan request created successfully',
      loan,
      status: 'Pending Marketplace',
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/request', (req, res) => {
  try {
    const loan = createLoanRequest(req.body);
    res.json({
      success: true,
      message: 'Loan request created successfully',
      loan,
      status: 'Pending Marketplace',
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/history', (req, res) => {
  const walletAddress = req.query.walletAddress || req.headers['x-wallet-address'];
  res.json({
    success: true,
    loans: getLoanHistory(walletAddress || ''),
  });
});

router.get('/my-loans', (req, res) => {
  const walletAddress = req.query.walletAddress || req.headers['x-wallet-address'];
  res.json({
    success: true,
    loans: getLoanHistory(walletAddress || ''),
  });
});

router.post('/pay-emi', (req, res) => {
  try {
    const { loanId, emiAmount } = req.body;
    const result = payEmi(loanId, Number(emiAmount || 0));
    res.json({
      success: true,
      message: `EMI payment processed for ${loanId}`,
      status: 'Paid',
      txHash: `0x${Math.random().toString(16).substring(2)}`,
      result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
