import React, { useState } from 'react';
import { VESTING_VAULT_SOL, MOCK_TOKEN_SOL, VESTING_VAULT_ABI } from '../contracts/VestingVaultSol';
import { Copy, Check, Download, FileCode, ShieldCheck, Zap, Lock } from 'lucide-react';

export const CodeViewer: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'VestingVault.sol' | 'ICOToken.sol' | 'VestingVaultABI.json'>('VestingVault.sol');
  const [copied, setCopied] = useState<boolean>(false);

  const getActiveCode = () => {
    switch (activeFile) {
      case 'VestingVault.sol':
        return VESTING_VAULT_SOL;
      case 'ICOToken.sol':
        return MOCK_TOKEN_SOL;
      case 'VestingVaultABI.json':
        return JSON.stringify(VESTING_VAULT_ABI, null, 2);
    }
  };

  const codeText = getActiveCode();

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codeText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = codeText.split('\n');

  return (
    <div className="space-y-6">
      {/* Smart Contract Architectural Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
            <ShieldCheck className="w-4 h-4" />
            OpenZeppelin Standards
          </div>
          <p className="text-xs text-slate-400">
            Utilizes <span className="text-slate-200 font-mono">SafeERC20</span>, <span className="text-slate-200 font-mono">ReentrancyGuard</span>, <span className="text-slate-200 font-mono">Ownable</span>, and <span className="text-slate-200 font-mono">Pausable</span> for bank-grade security.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <Lock className="w-4 h-4" />
            Cliff & Slice Precision Math
          </div>
          <p className="text-xs text-slate-400">
            Enforces strict cliff timestamp lock before linear release. Slice period prevents sub-second gas spamming while preserving granular unlocking.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <Zap className="w-4 h-4" />
            Gas Optimized Storage
          </div>
          <p className="text-xs text-slate-400">
            Uses deterministic schedule hashes (`bytes32`) and packed struct slots to minimize storage layout overhead.
          </p>
        </div>
      </div>

      {/* Code Editor Frame */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header Bar */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* File Selector Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFile('VestingVault.sol')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeFile === 'VestingVault.sol'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              VestingVault.sol
            </button>

            <button
              onClick={() => setActiveFile('ICOToken.sol')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeFile === 'ICOToken.sol'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              ICOToken.sol
            </button>

            <button
              onClick={() => setActiveFile('VestingVaultABI.json')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${
                activeFile === 'VestingVaultABI.json'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              VestingVaultABI.json
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 text-xs font-mono rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download File
            </button>
          </div>
        </div>

        {/* Code Content View */}
        <div className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed scrollbar-thin">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-slate-900/50">
                  <td className="w-10 text-right pr-4 text-slate-600 select-none font-mono text-[11px]">
                    {i + 1}
                  </td>
                  <td className="whitespace-pre">
                    {/* Basic syntax coloring simulation */}
                    {line.startsWith('//') || line.startsWith(' *') || line.startsWith('/*') ? (
                      <span className="text-slate-500 italic">{line}</span>
                    ) : line.includes('contract ') || line.includes('function ') || line.includes('struct ') ? (
                      <span className="text-indigo-300 font-semibold">{line}</span>
                    ) : line.includes('event ') || line.includes('error ') ? (
                      <span className="text-amber-300">{line}</span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
