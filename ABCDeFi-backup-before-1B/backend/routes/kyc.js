import express from 'express';
import workflow from '../services/lendingWorkflow.cjs';

const router = express.Router();
const { createUserProfile, getUserProfile, completeKyc, getKycRequirements, submitKycVerification } = workflow;

/**
 * Step 1: Frontend calls POST /kyc/start
 * Backend creates an applicant and returns the token required to launch the verification flow.
 */
router.post('/start', (req, res) => {
  const { walletAddress, country = 'India' } = req.body;

  if (!walletAddress) {
    return res.status(400).json({ error: 'walletAddress is required' });
  }

  const requirements = getKycRequirements(country);
  const submitted = submitKycVerification({ walletAddress, country, ...req.body, reviewMode: req.body.reviewMode || requirements.reviewMode });
  const user = createUserProfile({ walletAddress, country, name: req.body.name || submitted.user?.name });
  user.country = country;
  user.kycStatus = submitted.status;
  user.provider = submitted.provider;
  user.documentType = submitted.documentType;
  user.reviewMode = submitted.reviewMode;
  user.kycUpdatedAt = new Date().toISOString();

  console.log(`[KYC] Generating ${requirements.provider} session for ${walletAddress} in ${country}`);

  res.json({
    sdkToken: `mock-sumsub-token-${Date.now()}`,
    applicantId: `app_${walletAddress.slice(0, 8)}`,
    kycStatus: user.kycStatus,
    country,
    requirements,
    user,
  });
});

/**
 * Direct Instant KYC Approval (used by KYC Modal)
 */
router.post('/complete', (req, res) => {
  const { wallet, address, name, country = 'United States', status = 'approved' } = req.body;
  const targetWallet = wallet || address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  const user = completeKyc(targetWallet, status, { country });
  if (name) user.name = name;

  res.json({
    success: true,
    message: 'Identity verification approved successfully',
    kycStatus: user.kycStatus,
    user,
  });
});

router.post('/approve', (req, res) => {
  const { wallet, address, status = 'approved' } = req.body;
  const targetWallet = wallet || address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

  const user = completeKyc(targetWallet, status);
  res.json({
    success: true,
    message: 'KYC approved successfully',
    kycStatus: user.kycStatus,
    user,
  });
});

/**
 * Step 2: Sumsub sends a webhook to this backend with the verification result.
 */
router.post('/webhook', (req, res) => {
  const { applicantId, reviewResult, walletAddress, country = 'India', reviewStatus } = req.body;
  const reviewAnswer = reviewResult?.reviewAnswer || reviewResult?.reviewStatus || reviewStatus || 'PENDING';
  const normalized = String(reviewAnswer).toUpperCase();
  const status = normalized === 'GREEN' ? 'approved' : normalized === 'RED' ? 'rejected' : 'pending';

  console.log(`[KYC Webhook] Received webhook for ${applicantId}. Status: ${reviewAnswer}`);

  const user = completeKyc(walletAddress, status, { country, provider: 'Sumsub' });
  res.status(200).json({ success: true, message: 'Webhook processed successfully', kycStatus: user.kycStatus, country });
});

router.post('/manual', (req, res) => {
  const submitted = submitKycVerification({ ...req.body, reviewMode: 'manual' });
  res.json({ success: true, message: 'Manual KYC submitted for review', ...submitted });
});

/**
 * Step 3: Frontend checks KYC status when logging into ABCDeFi
 */
router.get('/status/:walletAddress', (req, res) => {
  const { walletAddress } = req.params;
  const user = getUserProfile(walletAddress);

  res.json({
    wallet: walletAddress,
    kycStatus: user?.kycStatus || 'unverified',
    user,
  });
});

export default router;
