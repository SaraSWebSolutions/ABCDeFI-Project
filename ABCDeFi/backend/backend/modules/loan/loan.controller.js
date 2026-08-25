const crypto = require('crypto');
const Loan = require('./loan.model');
const Deposit = require('../user/deposit/deposit.model');
const UserAccount = require('../user/userAccount/userAccount.model');
const Wallet = require('../user/userAccount/wallet.model');
const loanService = require('./loan.service');
const config = require('../../config/default');

/**
 * Preview loan calculations before submitting
 */
exports.previewLoan = async (req, res) => {
  try {
    const { loanAmount, collateralValue, duration } = req.body;

    if (!loanAmount || !collateralValue || !duration) {
      return res.status(400).json({ success: false, message: 'Missing required parameters' });
    }

    const ltv = loanService.calculateLTV(parseFloat(loanAmount), parseFloat(collateralValue));
    const validation = loanService.validateLTV(ltv);

    const calculations = loanService.calculateInterest(parseFloat(loanAmount), parseInt(duration));

    return res.status(200).json({
      success: true,
      data: {
        ltv,
        isValid: validation.isValid,
        validationMessage: validation.message,
        ...calculations
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Request a new loan
 */
exports.requestLoan = async (req, res) => {
  try {
    const { depositId, loanAmount, duration, walletAddress, txHash } = req.body;
    const userId = req.user.id;

    // 1. Verify KYC
    const user = await UserAccount.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.kycStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'KYC not approved. Cannot request a loan.' });
    }

    // 2. Verify Wallet
    const wallet = await Wallet.findOne({ userId, walletAddress: walletAddress.toLowerCase(), verified: true });
    if (!wallet) {
      return res.status(403).json({ success: false, message: 'Unverified wallet.' });
    }

    // 3. Verify Deposit
    const deposit = await Deposit.findOne({ depositId, userId });
    if (!deposit) {
      return res.status(404).json({ success: false, message: 'Deposit not found.' });
    }
    if (deposit.status !== 'Locked') {
      return res.status(400).json({ success: false, message: 'Collateral is not fully locked yet.' });
    }

    // 4. Validate LTV
    const collateralValue = parseFloat(deposit.usdValue || '0'); // Must be updated by oracle/price feed realistically
    if (collateralValue <= 0) {
       return res.status(400).json({ success: false, message: 'Invalid collateral value.' });
    }
    
    const ltv = loanService.calculateLTV(parseFloat(loanAmount), collateralValue);
    const validation = loanService.validateLTV(ltv);
    
    if (!validation.isValid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    // 5. Create Loan Record
    const loanId = crypto.randomUUID();
    const loan = new Loan({
      loanId,
      borrowerId: userId,
      depositId,
      collateralValue: deposit.usdValue,
      loanAmount,
      interestRate: config.DEFAULT_INTEREST_RATE || 10.8,
      duration,
      ltv,
      status: 'Requested'
    });

    await loan.save();

    // Optionally update deposit to indicate it's being used as collateral for a loan
    deposit.loanId = loanId;
    await deposit.save();

    return res.status(201).json({
      success: true,
      message: 'Loan requested successfully',
      data: { loanId, ltv, status: loan.status }
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get user loans
 */
exports.getUserLoans = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id || req.query?.userId;
    const query = userId ? { borrowerId: userId } : {};
    const loans = await Loan.find(query).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, loans, data: loans });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
