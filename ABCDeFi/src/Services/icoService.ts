import { api } from './axiosConfig';

export interface IcoConfig {
  referralBonusPct: number;
  stages: Array<{ id: string; name: string; tokenPrice: number; bonusPct: number; status: string }>;
  allocations: Array<{ label: string; pct: number }>;
}

export interface IcoPurchase {
  id: string;
  walletAddress: string;
  phase: string;
  amountUSD: number;
  tokensPurchased: number;
  bonusTokens: number;
  referralCode?: string;
  referralBonusTokens: number;
  totalTokens: number;
  txHash: string;
  createdAt: string;
  status: string;
}

export const IcoService = {
  getConfig: async (): Promise<IcoConfig> => {
    const response = await api.get('/ico/config');
    return response.data.config;
  },

  getStats: async () => {
    const response = await api.get('/ico/stats');
    return response.data;
  },

  buyTokens: async (walletAddress: string, phase: string, amountUSD: number, referralCode?: string): Promise<IcoPurchase> => {
    const payload: any = { walletAddress, phase, amountUSD };
    if (referralCode) payload.referralCode = referralCode;
    const response = await api.post('/ico/purchase', payload);
    return response.data.purchase;
  },

  getPurchases: async (walletAddress: string): Promise<IcoPurchase[]> => {
    const response = await api.get(`/ico/purchases/${encodeURIComponent(walletAddress)}`);
    return response.data.purchases;
  },
  createReferral: async (walletAddress: string) => {
    const response = await api.post('/ico/referral', { walletAddress });
    return response.data.referral;
  },

  getReferrals: async (walletAddress: string) => {
    const response = await api.get(`/ico/referrals/${encodeURIComponent(walletAddress)}`);
    return response.data.referrals;
  },

  getVesting: async (walletAddress: string) => {
    const response = await api.get(`/ico/vesting/${encodeURIComponent(walletAddress)}`);
    return response.data.vestingSchedules;
  },
};
