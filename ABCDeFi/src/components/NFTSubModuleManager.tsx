import React, { useState } from 'react';
import { Tag, Gift, Repeat, Award, CheckCircle2, ShieldCheck, Download, Sliders, RefreshCw, ArrowUpRight } from 'lucide-react';
import Web3ActionModal from './Web3ActionModal';

interface NFTSubModuleManagerProps {
  tab: 'marketplace-fees' | 'nft-airdrops' | 'gift-barter-rules';
  userAddress?: string;
}

export const NFTSubModuleManager: React.FC<NFTSubModuleManagerProps> = ({
  tab,
  userAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
}) => {
  const [msg, setMsg] = useState<string | null>(null);

  // Web3 Action Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    contractName: string;
    methodName: string;
    amountLabel: string;
    amountValue: string;
    params: { label: string; value: string }[];
    icon: string;
    onExecute: () => Promise<void> | void;
    onSuccessMutation: () => void;
  }>({
    isOpen: false,
    title: '',
    subtitle: '',
    contractName: '',
    methodName: '',
    amountLabel: '',
    amountValue: '',
    params: [],
    icon: '🎨',
    onExecute: () => {},
    onSuccessMutation: () => {},
  });

  const triggerAction = (title: string, contract: string, method: string, amount: string, icon: string = '🎨') => {
    setModalState({
      isOpen: true,
      title: `Execute ${title}`,
      subtitle: `Smart Contract Execution for ${title}`,
      contractName: contract,
      methodName: method,
      amountLabel: 'Amount / Fee',
      amountValue: amount,
      params: [
        { label: 'Executor Address', value: userAddress },
        { label: 'Module', value: tab },
        { label: 'Network', value: 'Ethereum Sepolia Mainnet' },
      ],
      icon,
      onExecute: async () => {
        await new Promise((r) => setTimeout(r, 1000));
      },
      onSuccessMutation: () => {
        setMsg(`Successfully executed "${title}" on-chain!`);
        setTimeout(() => setMsg(null), 4000);
      },
    });
  };

  return (
    <div className="space-y-6 text-slate-100 font-mono">
      {/* Feedback Alert */}
      {msg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{msg}</span>
        </div>
      )}

      {/* 1. MARKETPLACE FEES */}
      {tab === 'marketplace-fees' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/40">
                <Tag className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">NFT Marketplace Fee Configuration & Revenue Pool</h2>
                <p className="text-xs text-slate-400">Real-time marketplace trading fee splits, treasury accruals, and royalty rules.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Update Marketplace Fee Parameters', 'NFTMarketplace', 'setFeeRates', '2.5% Fee', '⚙️')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              Update Fee Rates ⚙️
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Fees Accrued</div>
              <div className="text-2xl font-black text-emerald-400">$142,500 USDC</div>
              <div className="text-[10px] text-slate-400">Protocol Share: 0.5% per Tx</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Creator Royalty Rate</div>
              <div className="text-2xl font-black text-indigo-400">1.0% APY</div>
              <div className="text-[10px] text-slate-400">Auto-routed to Original Artist</div>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Marketplace Platform Fee</div>
              <div className="text-2xl font-black text-amber-400">2.5% Total</div>
              <div className="text-[10px] text-slate-400">Lowest in Web3 DeFi</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. NFT AIRDROPS */}
      {tab === 'nft-airdrops' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-500/20 rounded-2xl border border-pink-500/40">
                <Gift className="w-6 h-6 text-pink-400 animate-bounce" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Legion Territory & Guru NFT Airdrop Portal</h2>
                <p className="text-xs text-slate-400">Claim promotional territory NFTs awarded to top stakers and franchise node owners.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-pink-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-bold text-pink-300 text-sm">Eligible Airdrop: Hyderabad Cyberabad Node NFT #002</div>
              <div className="text-[11px] text-slate-400">Status: Eligible (Top Staker Tier 1) • Claim Fee: Free (+ Gas)</div>
            </div>
            <button
              onClick={() => triggerAction('Claim Airdrop Territory NFT', 'LegionNFT', 'claimAirdrop', '0.00 ETH', '🎁')}
              className="px-6 py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-lg shadow-pink-600/30 whitespace-nowrap"
            >
              Claim Airdrop NFT 🎁
            </button>
          </div>
        </div>
      )}

      {/* 3. GIFT RULES */}
      {tab === 'gift-barter-rules' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-500/20 rounded-2xl border border-pink-500/40">
                <Gift className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Appreciating Token Gifts Rules</h2>
                <p className="text-xs text-slate-400">Wrap yields in time-locked gift NFTs for friends and family.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 text-xs">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="font-bold text-pink-300">1. Appreciating Gift Tokens</div>
              <p className="text-[11px] text-slate-400">Deposit ABCD/ETH into a time-locked NFT and transfer it to a friend. Tokens earn yield while wrapped!</p>
              <button
                onClick={() => triggerAction('Wrap Tokens in Gift NFT', 'GiftVault', 'wrapGift', '500 ABCD', '🎁')}
                className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold rounded-xl transition cursor-pointer shadow-lg shadow-pink-600/20"
              >
                Wrap & Send Gift NFT 🎁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WEB3 ACTION MODAL */}
      <Web3ActionModal
        {...modalState}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default NFTSubModuleManager;
