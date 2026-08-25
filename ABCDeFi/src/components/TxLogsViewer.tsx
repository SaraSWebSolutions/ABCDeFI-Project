import React from 'react';
import { TxLog } from '../types';
import { Clock, CheckCircle2, AlertCircle, FileText, ArrowRight } from 'lucide-react';

interface TxLogsViewerProps {
  logs: TxLog[];
  formatUnits: (amount: bigint) => string;
}

export const TxLogsViewer: React.FC<TxLogsViewerProps> = ({ logs }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            EVM Transaction & Event Log History ({logs.length})
          </h3>
          <p className="text-xs text-slate-400">
            Real-time simulated EVM block execution traces and contract event emissions.
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-500 font-mono">
          No transactions executed yet. Create a schedule or claim tokens to view EVM logs.
        </div>
      ) : (
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {logs.map((tx) => (
            <div
              key={tx.id}
              className={`bg-slate-950 border rounded-xl p-4 font-mono text-xs space-y-2 transition ${
                tx.status === 'success' ? 'border-slate-800' : 'border-red-900/50 bg-red-950/10'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  {tx.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}

                  <span className="font-bold text-white text-sm">{tx.functionName}()</span>

                  <span
                    className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                      tx.status === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    {tx.status.toUpperCase()}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500">
                  Tx Hash: <span className="text-slate-300">{tx.hash.slice(0, 14)}...</span> | Gas Used:{' '}
                  <span className="text-indigo-300">{tx.gasUsed.toLocaleString()}</span>
                </div>
              </div>

              {/* Call Parameters */}
              <div className="flex flex-col sm:flex-row gap-4 text-[11px] text-slate-400">
                <div>
                  <span className="text-slate-500">From: </span>
                  <span className="text-slate-200">{tx.from.slice(0, 10)}...</span>
                </div>
                <div>
                  <span className="text-slate-500">To: </span>
                  <span className="text-slate-200">{tx.to.slice(0, 10)}...</span>
                </div>
                <div>
                  <span className="text-slate-500">Args: </span>
                  <span className="text-amber-300">{tx.args.join(', ') || 'none'}</span>
                </div>
              </div>

              {/* Error Reason if reverted */}
              {tx.errorReason && (
                <div className="text-red-300 bg-red-950/40 p-2 rounded border border-red-900/40 text-[11px]">
                  Revert Reason: <strong className="font-mono">{tx.errorReason}</strong>
                </div>
              )}

              {/* Emitted Events */}
              {tx.eventsEmitted.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-800/60 space-y-1">
                  <span className="text-[10px] text-indigo-400 font-semibold uppercase">
                    Emitted Events:
                  </span>
                  {tx.eventsEmitted.map((evt, idx) => (
                    <div
                      key={idx}
                      className="bg-indigo-950/30 border border-indigo-900/40 p-2 rounded text-[11px] flex flex-wrap items-center gap-2"
                    >
                      <span className="font-bold text-amber-300">{evt.name}</span>
                      <span className="text-slate-400">
                        {Object.entries(evt.params)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
