/**
 * Backend Referral Service Module
 */

export interface ReferralRecord {
  id: string;
  referrerId: string;
  referredUserId: string;
  referralCode?: string;
  createdAt: string;
}

const referralStore: ReferralRecord[] = [];

/**
 * Handles referral connection when a new user registers with a referral code.
 */
export async function handleReferralOnRegister(referrerId: string, newUserId: string, referralCode?: string): Promise<ReferralRecord> {
  const record: ReferralRecord = {
    id: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    referrerId,
    referredUserId: newUserId,
    referralCode,
    createdAt: new Date().toISOString()
  };

  referralStore.push(record);
  return record;
}

/**
 * Gets referral metrics for a given user.
 */
export async function getReferralsByReferrer(referrerId: string): Promise<ReferralRecord[]> {
  return referralStore.filter(r => r.referrerId === referrerId);
}
