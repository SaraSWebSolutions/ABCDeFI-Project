const crypto = require('crypto');
const ethers = require('ethers');
const Wallet = require('./wallet.model');
const UserAccount = require('./userAccount.model');
const config = require('../../../config/default');

// Helper to generate a cryptographically secure nonce
function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}

function buildSiweMessage({ walletAddress, chainId, nonce, issuedAt, expiresAt }) {
  const uri = config.frontend_url;
  const domain = new URL(uri).host;

  return `${domain} wants you to sign in with your Ethereum account:\n${walletAddress}\n\nSign in to ABCDeFi\n\nURI: ${uri}\nVersion: 1\nChain ID: ${chainId}\nNonce: ${nonce}\nIssued At: ${issuedAt.toISOString()}\nExpiration Time: ${expiresAt.toISOString()}`;
}

/**
 * GET /wallet/nonce
 * Returns a nonce for the authenticated user to sign.
 * The nonce is stored in the user's document (walletNonce) and expires after config.walletNonceTTL seconds.
 */
async function getWalletNonce(req, res) {
  try {
    const userId = req.user.id; // auth middleware attaches user
    const nonce = generateNonce();
    // Store nonce and expiry in the user document
    await UserAccount.findByIdAndUpdate(userId, {
      walletLoginNonce: nonce,
      walletLoginNonceExpires: new Date(Date.now() + (config.walletNonceTTL || 300) * 1000),
      walletLoginMessage: null,
    });
    res.json({ success: true, nonce, message: 'Sign this nonce with your wallet to verify ownership.' });
  } catch (err) {
    console.error('Error generating wallet nonce:', err);
    res.status(500).json({ success: false, message: 'Failed to generate nonce.' });
  }
}

/**
 * POST /wallet/verify
 * Body: { walletAddress, signature, chainId, walletType }
 * Verifies the signature against the stored nonce and links the wallet to the user.
 */
async function verifyAndLinkWallet(req, res) {
  const { walletAddress, signature, chainId, walletType } = req.body;
  if (!walletAddress || !signature || !chainId || !walletType) {
    return res.status(400).json({ success: false, message: 'Missing required fields.' });
  }

  // Enforce allowed chains
  const allowed = config.allowedChains || [56, 97];
  if (!allowed.includes(Number(chainId))) {
    return res.status(400).json({ success: false, message: 'Unsupported network. Please switch to BNB Smart Chain.' });
  }

  try {
    const userId = req.user.id;
    const user = await UserAccount.findById(userId);
    if (!user || !user.walletLoginNonce) {
      return res.status(400).json({ success: false, message: 'No nonce found. Request a new nonce.' });
    }
    // Check expiry
    if (user.walletLoginNonceExpires && user.walletLoginNonceExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Nonce expired. Request a new nonce.' });
    }
    // Recover address from signature
    const recovered = ethers.verifyMessage(user.walletLoginNonce, signature);
    if (recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Signature verification failed.' });
    }

    const normalizedAddress = walletAddress.toLowerCase();
    const existingWallet = await Wallet.findOne({ walletAddress: normalizedAddress });
    if (existingWallet && String(existingWallet.userId) !== String(userId)) {
      return res.status(409).json({ success: false, message: 'This wallet is already linked to another ABCDeFi account.' });
    }

    // Upsert wallet document (one primary wallet per user)
    await Wallet.findOneAndUpdate(
      { userId },
      {
        userId,
        walletAddress: normalizedAddress,
        walletType,
        chainId: Number(chainId),
        verified: true,
        linkedAt: new Date(),
        lastConnectedAt: new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Keep the account and canonical wallet records synchronized for SIWE login.
    user.walletAddress = normalizedAddress;
    user.walletLoginNonce = undefined;
    user.walletLoginNonceExpires = undefined;
    user.walletLoginMessage = undefined;
    user.lastLoginAt = new Date();
    await user.save();
    res.json({ success: true, message: 'Wallet verified and linked successfully.' });
  } catch (err) {
    console.error('Error verifying wallet signature:', err);
    res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
}

async function getWalletStatus(req, res, next) {
  try {
    const wallet = await Wallet.findOne({ userId: req.user.id, verified: true }).lean();
    if (!wallet) {
      return res.json({ success: true, linked: false, wallet: null });
    }

    return res.json({
      success: true,
      linked: true,
      wallet: {
        address: wallet.walletAddress,
        chainId: wallet.chainId,
        walletType: wallet.walletType,
        verified: wallet.verified,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getWalletNonce, verifyAndLinkWallet, getWalletStatus, buildSiweMessage };
