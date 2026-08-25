import { Request, Response } from 'express';
import { Referral, ReferralReward, ReferralClaim } from '../models';
import { Op } from 'sequelize';

/**
 * Validate a referral code.
 * Returns the referrer user ID if valid, otherwise null.
 */
export async function validateReferralCode(code: string): Promise<string | null> {
  // Ensure uppercase and trim spaces
  const cleanCode = code.trim().toUpperCase();
  const referral = await Referral.findOne({ where: { referralCode: cleanCode } });
  if (!referral) return null;
  // Example expiration logic: codes expire after 90 days
  const created = new Date(referral.createdAt);
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 90) return null; // expired
  return referral.referrerId;
}

/**
 * Register a new user referral relationship.
 * Called after a user successfully registers.
 */
export async function registerReferral(
  referrerId: string,
  referredUserId: string,
  code?: string
): Promise<void> {
  if (!code) return; // optional
  const cleanCode = code.trim().toUpperCase();
  // Verify the code belongs to the claimed referrer
  const ref = await Referral.findOne({ where: { referralCode: cleanCode, referrerId } });
  if (!ref) {
    // If the code does not exist, create a new mapping (first‑time use)
    await Referral.create({
      referrerId,
      referredUserId,
      referralCode: cleanCode,
    });
  } else {
    // Update the referred user if not already set
    if (!ref.referredUserId) {
      await ref.update({ referredUserId });
    }
  }
}

/**
 * Gather dashboard data for a referrer.
 */
export async function getReferralDashboard(userId: string) {
  const totalReferrals = await Referral.count({ where: { referrerId: userId } });

  const rewards = await ReferralReward.findAll({ where: { userId } });
  const pending = rewards.filter(r => r.status === 'PENDING');
  const claimable = pending.reduce((sum, r) => sum + Number(r.amount), 0);
  const claimed = rewards
    .filter(r => r.status === 'CLAIMED')
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const breakdown = {
    ICO: rewards.filter(r => r.rewardType === 'ICO').reduce((s, r) => s + Number(r.amount), 0),
    LENDING: rewards.filter(r => r.rewardType === 'LENDING').reduce((s, r) => s + Number(r.amount), 0),
    BORROWING: rewards.filter(r => r.rewardType === 'BORROWING').reduce((s, r) => s + Number(r.amount), 0),
  };

  return {
    totalReferrals,
    pendingRewards: pending.length,
    claimableRewards: claimable,
    claimedRewards: claimed,
    breakdown,
  };
}

/**
 * List referral history (registrations + rewards).
 */
export async function getReferralHistory(userId: string) {
  const registrations = await Referral.findAll({ where: { referrerId: userId } });
  const rewards = await ReferralReward.findAll({ where: { userId } });
  return { registrations, rewards };
}

/**
 * Claim all pending rewards for a user.
 */
export async function claimRewards(userId: string, walletAddress: string) {
  const pending = await ReferralReward.findAll({
    where: { userId, status: 'PENDING' },
  });
  if (pending.length === 0) {
    throw new Error('No pending rewards to claim');
  }
  const totalAmount = pending.reduce((sum, r) => sum + Number(r.amount), 0);

  // Here we would call the CommissionDistributor contract via ethers.
  // For now we simulate a tx hash.
  const fakeTxHash = `0x${Math.random().toString(16).substr(2, 64)}`;

  // Update reward rows to CLAIMED
  await Promise.all(
    pending.map(r => r.update({ status: 'CLAIMED' }))
  );

  // Record claim entry
  await ReferralClaim.create({
    userId,
    amount: totalAmount.toString(),
    transactionHash: fakeTxHash,
    claimedAt: new Date().toISOString(),
  });

  return { txHash: fakeTxHash, claimedAmount: totalAmount };
}

/**
 * Generate a share link for a user.
 */
export async function getShareLink(userId: string) {
  // Ensure a referral code exists for the user
  let referral = await Referral.findOne({ where: { referrerId: userId } });
  if (!referral) {
    // Generate a deterministic code: first 6 characters of a hash
    const crypto = await import('crypto');
    const raw = crypto.createHash('sha256').update(userId).digest('hex').substr(0, 6).toUpperCase();
    referral = await Referral.create({
      referrerId: userId,
      referralCode: raw,
    });
  }
  const base = (import.meta as any).env?.VITE_APP_BASE_URL || 'http://localhost:3000';
  const link = `${base}/register?ref=${referral.referralCode}`;
  return { referralCode: referral.referralCode, link };
}
