import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Send, Terminal, Shield, Key } from 'lucide-react';

export const ApiDbInspector: React.FC = () => {
  const [dbTables, setDbTables] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<'users' | 'wallets' | 'kyc' | 'refresh_tokens' | 'blockchainLogs'>('users');

  const fetchDb = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/db-tables');
      const data = await res.json();
      setDbTables(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  return (
    <div className="space-y-8">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-400 text-xs font-semibold border border-cyan-800">
                PostgreSQL & Webhooks
              </span>
              <h2 className="text-xl font-bold text-slate-100">Database & API Endpoint Inspector</h2>
            </div>
            <p className="text-xs text-slate-400">
              Live inspection of PostgreSQL tables (users, wallets, kyc, refresh_tokens) and webhook audit logs.
            </p>
          </div>

          <button
            onClick={fetchDb}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center space-x-2 self-start md:self-auto transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Tables</span>
          </button>
        </div>
      </div>

      {/* Table Selector */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          {(['users', 'wallets', 'kyc', 'refresh_tokens', 'blockchainLogs'] as const).map((tbl) => (
            <button
              key={tbl}
              onClick={() => setSelectedTable(tbl)}
              className={`px-3.5 py-1.5 rounded-xl font-mono text-xs transition ${
                selectedTable === tbl
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              table: {tbl}
            </button>
          ))}
        </div>

        {/* JSON Viewer */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto">
          <div className="flex justify-between items-center mb-2 text-xs font-mono text-slate-400">
            <span>TABLE: {selectedTable.toUpperCase()}</span>
            <span>Count: {dbTables?.[selectedTable]?.length || 0} Records</span>
          </div>

          <pre className="text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[400px]">
            {dbTables?.[selectedTable]
              ? JSON.stringify(dbTables[selectedTable], null, 2)
              : 'Loading table data...'}
          </pre>
        </div>
      </div>

      {/* Backend API Endpoints Reference Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Backend APIs Implemented</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-bold">POST /api/user/register</span>
            <p className="text-[10px] text-slate-400">Creates user, hashes password with bcrypt, dispatches email verification token.</p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-bold">POST /api/user/verify-otp</span>
            <p className="text-[10px] text-slate-400">Validates verification token and updates status = true.</p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-bold">POST /api/user/login</span>
            <p className="text-[10px] text-slate-400">Verifies bcrypt password, issues JWT Access & Refresh Tokens.</p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-bold">POST /api/wallet/verify</span>
            <p className="text-[10px] text-slate-400">Verifies EIP-1193 signature against server nonce challenge via ethers.js.</p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-bold">POST /api/kyc/start</span>
            <p className="text-[10px] text-slate-400">Initializes Sumsub applicant record and returns SDK access token.</p>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-bold">POST /api/webhooks/sumsub</span>
            <p className="text-[10px] text-slate-400">Processes Sumsub review GREEN/RED event & calls RegistrationRegistry.sol.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
