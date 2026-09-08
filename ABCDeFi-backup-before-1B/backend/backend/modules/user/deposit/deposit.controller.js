const crypto = require('crypto');
const Deposit = require('./deposit.model');
const UserAccount = require('../userAccount/userAccount.model');
const Wallet = require('../userAccount/wallet.model');
const { JsonRpcProvider, isAddress } = require('ethers');
const { loadLendingManifest } = require('../../../config/lendingManifest.cjs');

/**
 * Creates a new Deposit record when a user initiates or completes a deposit transaction on-chain.
 */
exports.createDeposit = async (req, res) => {
  try {
    const { token, amount, walletAddress, loanId, txHash, chainId, usdValue } = req.body;
    const userId = req.user.id;
    const manifest = loadLendingManifest();
    if (!walletAddress || !isAddress(walletAddress) || !txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({ success: false, message: 'A valid wallet address and confirmed transaction hash are required.' });
    }
    if (Number(chainId) !== manifest.chainId) {
      return res.status(400).json({ success: false, message: `Deposits must use the canonical chain ${manifest.chainId}.` });
    }

    // 1. Verify User KYC
    const user = await UserAccount.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (user.kycStatus !== 'approved') {
      return res.status(403).json({ success: false, message: 'KYC not approved. Cannot deposit collateral.' });
    }

    // 2. Verify Wallet
    const wallet = await Wallet.findOne({ userId, walletAddress: walletAddress.toLowerCase(), verified: true, chainId: manifest.chainId });
    if (!wallet) {
      return res.status(403).json({ success: false, message: 'Unverified wallet. Please link and verify your wallet first.' });
    }

    const provider = new JsonRpcProvider(manifest.rpcUrl);
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt || receipt.status !== 1 || !receipt.to || receipt.to.toLowerCase() !== manifest.contracts.collateralVault.toLowerCase() || receipt.from.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'The transaction is not a confirmed collateral-vault deposit from the verified wallet.' });
    }

    const existing = await Deposit.findOne({ userId, chainId: manifest.chainId, txHash: txHash.toLowerCase() });
    if (existing) {
      return res.json({ success: true, message: 'Confirmed deposit was already recorded.', data: { depositId: existing.depositId, txHash: existing.txHash, status: existing.status } });
    }

    // 3. Create a record only after the canonical RPC independently confirms it.
    const depositId = crypto.randomUUID();
    const deposit = new Deposit({
      depositId,
      userId,
      walletAddress: walletAddress.toLowerCase(),
      loanId: loanId || null,
      token,
      amount,
      usdValue: usdValue || '0',
      chainId: manifest.chainId,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      status: 'Confirmed',
      confirmedAt: new Date(),
    });

    await deposit.save();

    res.status(201).json({
      success: true,
      message: 'Deposit recorded successfully',
      data: {
        depositId: deposit.depositId,
        txHash: deposit.txHash,
        status: deposit.status
      }
    });

  } catch (error) {
    console.error('Create Deposit Error:', error);
    res.status(500).json({ success: false, message: 'Server error creating deposit' });
  }
};

/**
 * Get deposits for the authenticated user
 */
exports.getDeposits = async (req, res) => {
  try {
    const userId = req.user.id;
    const deposits = await Deposit.find({ userId }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: deposits
    });
  } catch (error) {
    console.error('Get Deposits Error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving deposits' });
  }
};
