import React, { useState, useEffect } from 'react';
import { User, BlockchainRegistrationStatus, BlockchainLog } from '../types';
import { Cpu, CheckCircle2, ShieldCheck, ArrowRight, RefreshCw, Code, Terminal, ExternalLink } from 'lucide-react';

interface ContractRegistrySectionProps {
  user: User | null;
  onNextStep: () => void;
}

export const ContractRegistrySection: React.FC<ContractRegistrySectionProps> = ({
  user,
  onNextStep
}) => {
  const [queryWallet, setQueryWallet] = useState(user?.walletAddress || '0x71A4384918239014881920381029310892FD');
  const [onChainStatus, setOnChainStatus] = useState<BlockchainRegistrationStatus | null>(null);
  const [txLogs, setTxLogs] = useState<BlockchainLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchStatusAndLogs = async () => {
    setLoading(true);
    try {
      const statusRes = await fetch(`/api/blockchain/status?wallet=${queryWallet}`);
      const statusData = await statusRes.json();
      setOnChainStatus(statusData);

      const dbRes = await fetch('/api/admin/db-tables');
      const dbData = await dbRes.json();
      if (dbData.blockchainLogs) {
        setTxLogs(dbData.blockchainLogs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryWallet) {
      fetchStatusAndLogs();
    }
  }, [queryWallet]);

  return (
    <div className="space-y-8">
      
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-400 text-xs font-semibold border border-amber-800/60">
                Step 9
              </span>
              <h2 className="text-xl font-bold text-slate-100">BNB Smart Chain – RegistrationRegistry.sol</h2>
            </div>
            <p className="text-xs text-slate-400">
              Only wallet registration and KYC verification statuses are stored on-chain for privacy and compliance.
            </p>
          </div>

          <button
            onClick={onNextStep}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-950/50 flex items-center space-x-2 self-start md:self-auto transition"
          >
            <span>Next: Unlock DeFi Platform</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* On-Chain State Reader Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>On-Chain Storage Reader</span>
            </h3>
            <button
              onClick={fetchStatusAndLogs}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh On-Chain</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Target Wallet Address</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={queryWallet}
                onChange={(e) => setQueryWallet(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-amber-500"
                placeholder="0x71A4..."
              />
              <button
                onClick={fetchStatusAndLogs}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                Query
              </button>
            </div>
          </div>

          {onChainStatus && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Contract:</span>
                  <span className="text-amber-400 font-bold truncate max-w-[200px]">{onChainStatus.contractAddress}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">Network:</span>
                  <span className="text-slate-200">{onChainStatus.network}</span>
                </div>

                <div className="pt-2 border-t border-slate-900 grid grid-cols-2 gap-3">
                  <div className={`p-3 rounded-xl border ${
                    onChainStatus.isRegistered
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">mapping(address=&gt;bool)</span>
                    <span className="text-xs font-bold block mt-0.5">isRegistered</span>
                    <span className="text-sm font-black font-mono block mt-1">
                      {onChainStatus.isRegistered ? 'TRUE ✓' : 'FALSE ✗'}
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border ${
                    onChainStatus.isKycVerified
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}>
                    <span className="text-[10px] text-slate-400 block">mapping(address=&gt;bool)</span>
                    <span className="text-xs font-bold block mt-0.5">isKycVerified</span>
                    <span className="text-sm font-black font-mono block mt-1">
                      {onChainStatus.isKycVerified ? 'TRUE ✓' : 'FALSE ✗'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Solidity Smart Contract Code Viewer */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <span>RegistrationRegistry.sol Source</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Solidity ^0.8.20</span>
          </div>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto leading-relaxed max-h-[300px]">
{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract RegistrationRegistry {
    address public admin;

    mapping(address => bool) public isRegistered;
    mapping(address => bool) public isKycVerified;

    event UserRegistered(address indexed user, uint256 timestamp);
    event KYCStatusUpdated(address indexed user, bool status, uint256 timestamp);

    modifier onlyBackend() {
        require(msg.sender == admin, "Caller is not admin backend");
        _;
    }

    function register(address user) external onlyBackend {
        isRegistered[user] = true;
        emit UserRegistered(user, block.timestamp);
    }

    function approveKYC(address user) external onlyBackend {
        isKycVerified[user] = true;
        emit KYCStatusUpdated(user, true, block.timestamp);
    }

    function setKYCStatus(address user, bool status) external onlyBackend {
        isKycVerified[user] = status;
        emit KYCStatusUpdated(user, status, block.timestamp);
    }
}`}
          </pre>
        </div>

      </div>

      {/* Transaction Logs Inspector */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-bold text-slate-100 mb-4 pb-2 border-b border-slate-800 flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-yellow-400" />
            <span>On-Chain Transaction Log Stream</span>
          </span>
          <span className="text-xs text-slate-400 font-mono">{txLogs.length} Executed Transactions</span>
        </h3>

        {txLogs.length > 0 ? (
          <div className="space-y-2 overflow-x-auto">
            {txLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-bold text-[10px] border border-emerald-800">
                      {log.method}
                    </span>
                    <span className="text-slate-200 font-bold">{log.txHash}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Wallet: <span className="text-emerald-300">{log.userWallet}</span>
                  </p>
                </div>

                <div className="text-right text-[10px] text-slate-400">
                  <p className="text-slate-300 font-semibold">Block #{log.blockNumber}</p>
                  <p className="text-amber-400">Gas Used: {log.gasUsed}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
            No on-chain transactions executed yet. Connect wallet or approve KYC to dispatch transactions.
          </div>
        )}
      </div>
    </div>
  );
};
