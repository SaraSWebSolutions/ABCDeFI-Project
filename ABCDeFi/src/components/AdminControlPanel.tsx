import React, { useState } from 'react';

export const AdminControlPanel: React.FC = () => {
  const [activeStage, setActiveStage] = useState<'PrivateSale' | 'PreSale' | 'CrowdSale'>('CrowdSale');
  const [stageStatus, setStageStatus] = useState<'Active' | 'Paused' | 'Closed'>('Active');
  const [newPrice, setNewPrice] = useState<string>('0.08');
  const [referralAccount, setReferralAccount] = useState<string>('');
  const [fraudStatusMessage, setFraudStatusMessage] = useState<string>('');
  const [treasuryMessage, setTreasuryMessage] = useState<string>('');

  const handleStatusChange = (status: 'Active' | 'Paused' | 'Closed') => {
    setStageStatus(status);
  };

  const handleFreezeReferral = () => {
    if (!referralAccount) return;
    setFraudStatusMessage(`Account ${referralAccount.slice(0, 8)}... successfully frozen for fraud investigation.`);
    setReferralAccount('');
  };

  const handleTriggerTreasurySplit = () => {
    setTreasuryMessage(`Executed Treasury distributeFunds() across 8 vault buckets!`);
  };

  return (
    <div className="w-full bg-slate-950 text-white rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <span>⚙️</span> ABCDeFi Protocol Admin Control Panel
        </h2>
        <p className="text-xs text-slate-400 mt-1">Management dashboard for ICO stages, treasury splits, allocations, and anti-fraud enforcement.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 1: ICO Stage Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-md font-semibold text-slate-200 border-b border-slate-800 pb-2">ICO Stage Management</h3>
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Target Sale Stage</label>
              <select
                value={activeStage}
                onChange={(e) => setActiveStage(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="PrivateSale">Stage 1: Private Sale</option>
                <option value="PreSale">Stage 2: Pre Sale</option>
                <option value="CrowdSale">Stage 3: Crowd Sale</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Current Status: <span className="text-emerald-400 font-bold">{stageStatus}</span></label>
              <div className="flex gap-2">
                <button onClick={() => handleStatusChange('Active')} className="flex-1 py-2 bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 rounded-lg font-semibold hover:bg-emerald-600/40">Open Stage</button>
                <button onClick={() => handleStatusChange('Paused')} className="flex-1 py-2 bg-amber-600/30 border border-amber-500/50 text-amber-300 rounded-lg font-semibold hover:bg-amber-600/40">Pause Stage</button>
                <button onClick={() => handleStatusChange('Closed')} className="flex-1 py-2 bg-rose-600/30 border border-rose-500/50 text-rose-300 rounded-lg font-semibold hover:bg-rose-600/40">Close Stage</button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <label className="block text-slate-400 mb-1">Update Token Price (USD)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold text-white">Update Price</button>
              </div>
            </div>
          </div>
        </div>

        {/* Module 2: Anti-Fraud Referral & Treasury Controls */}
        <div className="space-y-6">
          {/* Fraud Freeze */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-md font-semibold text-slate-200 border-b border-slate-800 pb-2">Referral Anti-Fraud Control</h3>
            <p className="text-xs text-slate-400">Freeze suspicious referral accounts from claiming 0.05% buyer rewards.</p>
            <div className="flex gap-2 text-xs">
              <input
                type="text"
                placeholder="0x... Account Address"
                value={referralAccount}
                onChange={(e) => setReferralAccount(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
              />
              <button onClick={handleFreezeReferral} className="px-4 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg font-semibold text-white">Freeze Account</button>
            </div>
            {fraudStatusMessage && <p className="text-xs text-rose-400 font-mono mt-1">{fraudStatusMessage}</p>}
          </div>

          {/* Treasury Split Trigger */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-md font-semibold text-slate-200 border-b border-slate-800 pb-2">Treasury Funds Split Engine</h3>
            <p className="text-xs text-slate-400">Trigger on-chain 8-way split of collected ETH/USDT to dev, liquidity, marketing, audit, community, education, contingency, and reserve vaults.</p>
            <button onClick={handleTriggerTreasurySplit} className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 rounded-xl font-semibold text-xs text-white">
              ⚡ Execute Treasury distributeFunds()
            </button>
            {treasuryMessage && <p className="text-xs text-emerald-400 font-mono mt-1">{treasuryMessage}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
