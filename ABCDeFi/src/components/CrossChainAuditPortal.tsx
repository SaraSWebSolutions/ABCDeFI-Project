import React, { useState } from 'react';
import {
  ShieldCheck,
  Globe,
  History,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Sparkles,
  Loader2,
  Zap,
  Layers,
  ArrowRight,
  Database,
  Lock,
} from 'lucide-react';
import {
  INITIAL_AUDIT_TRAIL,
  AuditRecord,
  AuditCategory,
} from '../Services/auditTrail';
import {
  SUPPORTED_NETWORKS,
  SupportedNetwork,
  switchNetwork,
} from '../Services/crossChain';

export const CrossChainAuditPortal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'cross-chain'>('audit');
  const [auditLogs] = useState<AuditRecord[]>(INITIAL_AUDIT_TRAIL);
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetwork>(SUPPORTED_NETWORKS[1]); // Default Sepolia
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [switching, setSwitching] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const filteredLogs = auditLogs.filter((l) => {
    if (categoryFilter !== 'All' && l.category !== categoryFilter) return false;
    return true;
  });

  const handleNetworkSwitch = async (net: SupportedNetwork) => {
    setSwitching(true);
    setFeedbackMsg(`Switching network to ${net.name}...`);
    try {
      const res = await switchNetwork(net.chainId);
      setSelectedNetwork(res);
      setFeedbackMsg(`✓ Connected to ${res.name} (${res.symbol}) — Contract addresses synced!`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div id="cross-chain-audit-portal" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <span>Protocol Security & Expansion</span>
            <span className="text-slate-600">↓</span>
            <span>Audit Trail & Cross-Chain Networks</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <Globe className="w-6 h-6 text-purple-400" />
            Complete Audit Trail & Cross-Chain Expansion Portal
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable EVM Event & Database Audit Logs + Multi-Chain Expansion across Ethereum, Polygon, BNB Chain, Arbitrum, & Optimism.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 border border-purple-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Complete Audit Trail
          </button>
          <button
            onClick={() => setActiveTab('cross-chain')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'cross-chain'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Cross-Chain Networks
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNER */}
      {feedbackMsg && (
        <div className="p-3.5 bg-purple-950/40 border border-purple-800/50 rounded-xl text-xs text-purple-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {switching ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. COMPLETE AUDIT TRAIL LOGS                                              */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Filter Category:</span>
              {['All', 'Loans', 'NFTs', 'Users', 'Treasury', 'Platform Actions'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    categoryFilter === cat ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40' : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <span className="text-xs text-purple-300 font-bold">{filteredLogs.length} Indexed Logs</span>
          </div>

          <div className="space-y-3 text-xs">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-white text-sm">{log.action}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {log.category}
                    </span>
                    <span className="px-2 py-0.2 rounded text-[9px] font-bold bg-slate-900 text-slate-400">
                      {log.network}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                </div>

                <p className="text-xs text-slate-400">{log.details}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
                  <div>Actor: <span className="text-slate-300 font-bold">{log.actor}</span></div>
                  <div className="flex items-center gap-2">
                    <span>Tx: {log.txHash.substring(0, 10)}...</span>
                    {log.verifiedOnChain && (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> EVM Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CROSS-CHAIN EXPANSION (ETHEREUM, POLYGON, BSC, ARBITRUM, OPTIMISM)    */}
      {/* ========================================================================= */}
      {activeTab === 'cross-chain' && (
        <div className="space-y-6">
          {/* CURRENT CONNECTED NETWORK BANNER */}
          <div className="bg-slate-950 border border-indigo-500/40 p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selectedNetwork.icon}</span>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-bold">Active Network Environment</div>
                  <h3 className="text-xl font-black text-white">{selectedNetwork.name} (Chain ID: {selectedNetwork.chainId})</h3>
                  <div className="text-[10px] text-indigo-300 font-bold">{selectedNetwork.rpcUrl}</div>
                </div>
              </div>
              <span className="px-3.5 py-1.5 rounded-2xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                Bridge Status: {selectedNetwork.bridgeStatus} ✓
              </span>
            </div>

            {/* CONTRACT ADDRESSES ON SELECTED NETWORK */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono pt-2 border-t border-slate-800">
              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                <div className="text-[10px] text-slate-500 uppercase font-bold">ABCD Token</div>
                <div className="text-[11px] text-slate-300 font-bold truncate mt-1">{selectedNetwork.contracts.abcdToken}</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Lending Pool</div>
                <div className="text-[11px] text-slate-300 font-bold truncate mt-1">{selectedNetwork.contracts.lendingPool}</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Treasury Vault</div>
                <div className="text-[11px] text-slate-300 font-bold truncate mt-1">{selectedNetwork.contracts.treasuryVault}</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl">
                <div className="text-[10px] text-slate-500 uppercase font-bold">Legion NFT</div>
                <div className="text-[11px] text-slate-300 font-bold truncate mt-1">{selectedNetwork.contracts.legionNFT}</div>
              </div>
            </div>
          </div>

          {/* MULTI-CHAIN NETWORK SELECTOR */}
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2 border-b border-slate-800 pb-3">
              <Globe className="w-4 h-4 text-indigo-400" /> Supported Cross-Chain Networks ({SUPPORTED_NETWORKS.length})
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {SUPPORTED_NETWORKS.map((net) => {
                const isSelected = selectedNetwork.chainId === net.chainId;
                return (
                  <div
                    key={net.chainId}
                    className={`p-5 rounded-3xl border space-y-3 transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-xl shadow-indigo-500/10 ring-1 ring-indigo-500/40'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{net.icon}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-950 text-slate-300 border border-slate-800">
                          {net.type}
                        </span>
                      </div>
                      <div className="font-extrabold text-white text-sm">{net.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Chain ID: {net.chainId} • {net.symbol}</div>
                    </div>

                    <button
                      onClick={() => handleNetworkSwitch(net)}
                      disabled={switching}
                      className={`w-full font-bold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-950 hover:bg-slate-800 text-white border border-slate-800'
                      }`}
                    >
                      {isSelected ? 'Connected ✓' : 'Switch Network'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CrossChainAuditPortal;
