import React, { useState } from 'react';
import { Users, ShieldCheck, DollarSign, Search, CheckCircle2, Award, Building, FileText, Sliders, MapPin, Activity, AlertCircle } from 'lucide-react';
import Web3ActionModal from './Web3ActionModal';

interface FranchiseSubModuleManagerProps {
  tab: 'franchise-licensing' | 'operator-kyc' | 'revenue-share' | 'audit-franchisees';
  userAddress?: string;
}

export const FranchiseSubModuleManager: React.FC<FranchiseSubModuleManagerProps> = ({
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
    icon: '🏢',
    onExecute: () => {},
    onSuccessMutation: () => {},
  });

  const triggerAction = (title: string, contract: string, method: string, amount: string, icon: string = '🏢') => {
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
        { label: 'Franchise Module', value: tab },
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

      {/* 1. FRANCHISE LICENSING */}
      {tab === 'franchise-licensing' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/20 rounded-2xl border border-cyan-500/40">
                <Building className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Territory Franchise Master Licensing Engine</h2>
                <p className="text-xs text-slate-400">Mint State and District Master License NFTs to operate localized DeFi hubs.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Apply for Franchise Master License', 'FranchiseRegistry', 'mintLicenseNFT', '0.5 ETH', '📜')}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-cyan-600/20"
            >
              Apply for License 📜
            </button>
          </div>

          {/* 3 Tier License Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">District Tier</span>
                <span className="bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded text-[10px] border border-cyan-500/30">Tier 3</span>
              </div>
              <div className="text-2xl font-black text-cyan-400">$5,000 USD <span className="text-xs text-slate-500">(0.25 ETH)</span></div>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>• Coverage: 1 District (e.g. Cyberabad)</div>
                <div>• Population Reach: ~1.2M Citizens</div>
                <div>• Revenue Multiplier: <strong className="text-white">1.25x</strong></div>
                <div>• Staking Collateral Required: <strong className="text-amber-400">10,000 ABCD</strong></div>
              </div>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-indigo-500/40 space-y-3 shadow-lg shadow-indigo-950/50">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">State Master Tier</span>
                <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] border border-indigo-500/30">Tier 2</span>
              </div>
              <div className="text-2xl font-black text-indigo-400">$15,000 USD <span className="text-xs text-slate-500">(0.75 ETH)</span></div>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>• Coverage: 1 State Realm (e.g. Telangana)</div>
                <div>• Population Reach: ~3.8M Citizens</div>
                <div>• Revenue Multiplier: <strong className="text-white">1.50x</strong></div>
                <div>• Staking Collateral Required: <strong className="text-amber-400">25,000 ABCD</strong></div>
              </div>
            </div>

            <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/40 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">Country Guild Tier</span>
                <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] border border-amber-500/30">Tier 1</span>
              </div>
              <div className="text-2xl font-black text-amber-400">$50,000 USD <span className="text-xs text-slate-500">(2.50 ETH)</span></div>
              <div className="text-[11px] text-slate-400 space-y-1">
                <div>• Coverage: Full Country Guild (Bharat)</div>
                <div>• Population Reach: National Scale</div>
                <div>• Revenue Multiplier: <strong className="text-white">2.00x</strong></div>
                <div>• Staking Collateral Required: <strong className="text-amber-400">100,000 ABCD</strong></div>
              </div>
            </div>
          </div>

          {/* Active Territory Node Index */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Licensed Territory Master Nodes Index</span>
              <span className="text-cyan-400 font-bold">3 Licensed Nodes (Active)</span>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-cyan-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Node #HYD-001 — Cyberabad Territory (Telangana)</div>
                    <div className="text-[10px] text-slate-400">Master Operator: Bharat Web3 Tech Ltd • License NFT #1092 • Reach: 1.2M Citizens</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Active 🟢</span>
                  <button
                    onClick={() => triggerAction('Manage Cyberabad Territory Node', 'FranchiseRegistry', 'configureNode', '0.00 ETH', '⚙️')}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition cursor-pointer whitespace-nowrap"
                  >
                    Configure Node ⚙️
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-indigo-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Node #BLR-002 — Bengaluru Tech Hub (Karnataka)</div>
                    <div className="text-[10px] text-slate-400">Master Operator: Deccan Web3 Ventures • License NFT #1098 • Reach: 2.4M Citizens</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">Active 🟢</span>
                  <button
                    onClick={() => triggerAction('Configure Bengaluru Node', 'FranchiseRegistry', 'configureNode', '0.00 ETH', '⚙️')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition cursor-pointer whitespace-nowrap"
                  >
                    Configure Node ⚙️
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <div className="font-bold text-white">Node #BOM-003 — Mumbai Coastal Hub (Maharashtra)</div>
                    <div className="text-[10px] text-slate-400">Master Operator: Western DeFi Capital • License NFT #1105 • Reach: 3.1M Citizens</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">Pending KYB 🟡</span>
                  <button
                    onClick={() => triggerAction('Review Mumbai License Application', 'FranchiseRegistry', 'reviewLicense', '0.00 ETH', '📜')}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-lg transition cursor-pointer whitespace-nowrap"
                  >
                    Review Application 🔍
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. OPERATOR KYC */}
      {tab === 'operator-kyc' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 rounded-2xl border border-emerald-500/40">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Franchise Operator Corporate KYC & KYB Verification</h2>
                <p className="text-xs text-slate-400">Corporate registration, Officer verification, and Sumsub KYB status.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Submit Corporate Operator KYB', 'FranchiseKYC', 'verifyCorporateOperator', '0.00 ETH', '🏢')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-600/20"
            >
              Submit Operator KYB 🏢
            </button>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-emerald-500/40 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <div className="font-bold text-emerald-300 text-sm">Corporate Entity: Bharat Web3 Tech Ltd</div>
                <div className="text-[11px] text-slate-400">Registration ID: REG-IN-2026-90812 • Jurisdiction: Hyderabad, India</div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full font-bold text-[10px]">
                KYB Status ✅ Approved (Sumsub)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Corporate Certificate</div>
                <div className="font-bold text-white mt-0.5">Verified ✓</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Directors KYC</div>
                <div className="font-bold text-emerald-400 mt-0.5">3 / 3 Officers Verified ✓</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Sumsub Reference</div>
                <div className="font-bold text-indigo-400 mt-0.5">SUMSUB-KYB-90812</div>
              </div>
            </div>

            {/* Officer Records Table */}
            <div className="border-t border-slate-800 pt-3 space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase">Verified Corporate Officers</div>
              <div className="space-y-1.5">
                <div className="p-2.5 bg-slate-900 rounded-xl flex items-center justify-between text-xs">
                  <span>Rajesh Sharma (Managing Director) — Passport & Tax ID</span>
                  <span className="text-emerald-400 font-bold">Verified ✓</span>
                </div>
                <div className="p-2.5 bg-slate-900 rounded-xl flex items-center justify-between text-xs">
                  <span>Ananya Sen (Chief Compliance Officer) — Aadhaar & Proof of Address</span>
                  <span className="text-emerald-400 font-bold">Verified ✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. REVENUE SHARE */}
      {tab === 'revenue-share' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40">
                <DollarSign className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Regional Fee Revenue Share Pool (70/20/10 Split)</h2>
                <p className="text-xs text-slate-400">Claim regional transaction fees generated in your licensed territory.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Claim Regional Fee Revenue Share', 'FranchiseTreasury', 'claimRevenueShare', '$4,280 USDC', '💰')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer shadow-lg shadow-amber-600/20"
            >
              Claim Revenue Share ($4,280) 💰
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="bg-slate-950 p-5 rounded-2xl border border-emerald-500/40 space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Node Operator Share (70%)</div>
              <div className="text-3xl font-black text-emerald-400">$29,960 USDC</div>
              <div className="text-[10px] text-slate-400">Directly claimable by operator</div>
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-indigo-500/40 space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Protocol Treasury (20%)</div>
              <div className="text-3xl font-black text-indigo-400">$8,560 USDC</div>
              <div className="text-[10px] text-slate-400">Auto-routed to Treasury Vault</div>
            </div>
            <div className="bg-slate-950 p-5 rounded-2xl border border-amber-500/40 space-y-2">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Local Stakers Share (10%)</div>
              <div className="text-3xl font-black text-amber-400">$4,280 USDC</div>
              <div className="text-[10px] text-slate-400">Distributed to territory stakers</div>
            </div>
          </div>

          {/* Fee Stream Breakdown */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 text-xs font-mono">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Territory Fee Stream Sources (30-Day Period)</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">P2P Loan Origination Fees</div>
                <div className="text-white font-bold mt-0.5">$18,400 USDC</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">Staking Performance Fees</div>
                <div className="text-white font-bold mt-0.5">$12,200 USDC</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">NFT Marketplace Royalties</div>
                <div className="text-white font-bold mt-0.5">$12,200 USDC</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. AUDIT FRANCHISEES */}
      {tab === 'audit-franchisees' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-2xl border border-purple-500/40">
                <Search className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">Franchisee SLA Performance & Compliance Auditor</h2>
                <p className="text-xs text-slate-400">Audit node uptime SLAs, transaction throughput, and compliance scores.</p>
              </div>
            </div>
            <button
              onClick={() => triggerAction('Run Regional Franchise Audit', 'FranchiseAuditor', 'auditNodeSLA', '0.00 ETH', '🔍')}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-purple-600/20"
            >
              Run Franchise Audit 🔍
            </button>
          </div>

          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4 text-xs">
            <div className="flex justify-between items-center font-bold border-b border-slate-800 pb-2">
              <span className="text-white">Node Audit Score: Cyberabad Node #1</span>
              <span className="text-emerald-400">99.85% SLA Compliance (Pass)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">Default Incidents</div>
                <div className="text-emerald-400 font-bold mt-0.5">0 Reported</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">Uptime Score</div>
                <div className="text-cyan-400 font-bold mt-0.5">99.98%</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">Liquidity Backing</div>
                <div className="text-amber-400 font-bold mt-0.5">215%</div>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                <div className="text-[10px] text-slate-500">Slashing Risk</div>
                <div className="text-emerald-400 font-bold mt-0.5">0% (Safe)</div>
              </div>
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

export default FranchiseSubModuleManager;
