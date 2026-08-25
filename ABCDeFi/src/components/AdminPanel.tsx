import React, { useState } from 'react';
import { VestingSchedule, UserAccount, ContractState } from '../types';
import {
  ShieldCheck,
  PlusCircle,
  Pause,
  Play,
  ArrowDownCircle,
  AlertTriangle,
  User,
  Clock,
  Lock,
  Layers,
  Coins,
  ShieldX,
  Sparkles,
} from 'lucide-react';

interface AdminPanelProps {
  state: ContractState;
  accounts: UserAccount[];
  selectedAccount: UserAccount;
  currentTimestamp: number;
  onCreateSchedule: (
    beneficiary: string,
    start: number,
    cliff: number,
    duration: number,
    slicePeriodSeconds: number,
    revocable: boolean,
    amount: bigint
  ) => { success: boolean; message: string };
  onDepositTokens: (amount: bigint) => { success: boolean; message: string };
  onRevokeSchedule: (scheduleId: string) => { success: boolean; message: string };
  onTogglePause: () => { success: boolean; message: string };
  computeVestedAmount: (schedule: VestingSchedule, timestamp: number) => bigint;
  computeReleasableAmount: (schedule: VestingSchedule, timestamp?: number) => bigint;
  formatUnits: (amount: bigint) => string;
  formatDuration: (seconds: number) => string;
  unallocatedBalance: bigint;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  state,
  accounts,
  selectedAccount,
  currentTimestamp,
  onCreateSchedule,
  onDepositTokens,
  onRevokeSchedule,
  onTogglePause,
  computeVestedAmount,
  computeReleasableAmount,
  formatUnits,
  formatDuration,
  unallocatedBalance,
}) => {
  const isAdmin = (selectedAccount?.address && state?.owner)
    ? selectedAccount.address.toLowerCase() === state.owner.toLowerCase()
    : true;

  // Create Form State
  const [beneficiaryInput, setBeneficiaryInput] = useState<string>(accounts[1]?.address || '');
  const [amountInput, setAmountInput] = useState<string>('100000');
  const [startOffsetDays, setStartOffsetDays] = useState<number>(0); // 0 = start now
  const [cliffDays, setCliffDays] = useState<number>(30);
  const [durationDays, setDurationDays] = useState<number>(180);
  const [slicePeriodSeconds, setSlicePeriodSeconds] = useState<number>(86400); // 1 day
  const [revocable, setRevocable] = useState<boolean>(true);

  // Deposit Form State
  const [depositAmountInput, setDepositAmountInput] = useState<string>('500000');

  // Feedback Messages
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const amountNum = parseFloat(amountInput);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFeedback({ type: 'error', text: 'Please enter a valid positive token amount.' });
      return;
    }

    const amountBig = BigInt(Math.floor(amountNum)) * 10n ** 18n;
    const startTime = currentTimestamp + startOffsetDays * 86400;
    const cliffSec = cliffDays * 86400;
    const durationSec = durationDays * 86400;

    const res = onCreateSchedule(
      beneficiaryInput,
      startTime,
      cliffSec,
      durationSec,
      slicePeriodSeconds,
      revocable,
      amountBig
    );

    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
      setAmountInput('100000');
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const num = parseFloat(depositAmountInput);
    if (isNaN(num) || num <= 0) {
      setFeedback({ type: 'error', text: 'Please enter a valid deposit amount.' });
      return;
    }

    const amountBig = BigInt(Math.floor(num)) * 10n ** 18n;
    const res = onDepositTokens(amountBig);
    if (res.success) {
      setFeedback({ type: 'success', text: res.message });
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-8">
      {/* Non-Admin Warning */}
      {!isAdmin && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-amber-200 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold">Caller is not Vault Owner:</span> Actions will revert unless you switch to the Admin deployer wallet in the top bar.
            </div>
          </div>
          <button
            onClick={() => {
              const adminAcc = accounts.find((a) => a.role === 'admin');
              if (adminAcc) setBeneficiaryInput(adminAcc.address);
            }}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold cursor-pointer"
          >
            Select Admin Wallet
          </button>
        </div>
      )}

      {/* Global Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs sm:text-sm font-medium flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Vault Summary & Governance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="text-xs text-slate-400 font-mono uppercase">Vault Contract Balance</div>
          <div className="text-2xl font-bold text-white font-mono mt-1">
            {formatUnits(state.vaultTokenBalance)} <span className="text-xs text-slate-400">ICO</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">Tokens physically stored in contract buffer</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="text-xs text-indigo-400 font-mono uppercase">Unallocated Buffer</div>
          <div className="text-2xl font-bold text-indigo-300 font-mono mt-1">
            {formatUnits(unallocatedBalance)} <span className="text-xs text-indigo-400">ICO</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">Available to allocate to new schedules</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="text-xs text-amber-400 font-mono uppercase">Total Vested Allocation</div>
          <div className="text-2xl font-bold text-amber-300 font-mono mt-1">
            {formatUnits(state.totalVestedAmount)} <span className="text-xs text-amber-400">ICO</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">Active commitment across all beneficiaries</div>
        </div>

        {/* Emergency Pause Control */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-400 font-mono uppercase">Emergency Pause State</div>
            <div className="text-sm font-bold mt-1 flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  state.paused ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'
                }`}
              />
              <span className={state.paused ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                {state.paused ? 'PAUSED' : 'ACTIVE / NORMAL'}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              const res = onTogglePause();
              setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
            }}
            className={`mt-3 w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              state.paused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
            }`}
          >
            {state.paused ? (
              <>
                <Play className="w-3.5 h-3.5 fill-current" /> Unpause Vault Contract
              </>
            ) : (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" /> Emergency Pause Vault
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Forms Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Schedule Form */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Create Vesting Schedule</h3>
              <p className="text-xs text-slate-400">
                Lock ICO tokens for a beneficiary with optional cliff and linear release rate.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateSubmit} className="space-y-5">
            {/* Beneficiary Field with Quick Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Beneficiary Wallet Address
              </label>
              <input
                type="text"
                value={beneficiaryInput}
                onChange={(e) => setBeneficiaryInput(e.target.value)}
                placeholder="0x..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
              />
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-500 font-mono uppercase">Quick Select:</span>
                {accounts
                  .filter((a) => a.role === 'beneficiary')
                  .map((acc) => (
                    <button
                      type="button"
                      key={acc.address}
                      onClick={() => setBeneficiaryInput(acc.address)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono transition cursor-pointer"
                    >
                      {acc.label.split(' ')[0]} ({acc.address.slice(0, 6)}...)
                    </button>
                  ))}
              </div>
            </div>

            {/* Token Amount & Start Offset */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Allocation Amount (ICO Tokens)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="100000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-mono text-slate-500">ICO</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Vesting Start Date
                </label>
                <select
                  value={startOffsetDays}
                  onChange={(e) => setStartOffsetDays(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value={0}>Start Immediately (Current EVM Time)</option>
                  <option value={-30}>Backdate 30 Days Ago</option>
                  <option value={-60}>Backdate 60 Days Ago</option>
                  <option value={30}>Future Start (+30 Days from now)</option>
                </select>
              </div>
            </div>

            {/* Cliff & Total Duration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex justify-between">
                  <span>Cliff Period (Days)</span>
                  <span className="text-amber-400 font-mono">{cliffDays} Days</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max="730"
                  value={cliffDays}
                  onChange={(e) => setCliffDays(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Zero tokens claimable until cliff period expires.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex justify-between">
                  <span>Total Vesting Duration (Days)</span>
                  <span className="text-indigo-300 font-mono">{durationDays} Days</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="1825"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Total linear unlock timeline (must be ≥ cliff).
                </span>
              </div>
            </div>

            {/* Slice Period & Revocable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Slice Period (Release Interval)
                </label>
                <select
                  value={slicePeriodSeconds}
                  onChange={(e) => setSlicePeriodSeconds(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  <option value={1}>Per Second (Continuous Streaming)</option>
                  <option value={3600}>Per Hour</option>
                  <option value={86400}>Per Day (Daily Release)</option>
                  <option value={30 * 86400}>Per Month (30-day batches)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="revocableCheck"
                  checked={revocable}
                  onChange={(e) => setRevocable(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
                />
                <label htmlFor="revocableCheck" className="text-xs text-slate-300 cursor-pointer">
                  <span className="font-semibold block text-white">Revocable Schedule</span>
                  <span className="text-[11px] text-slate-400 block">
                    Allows vault owner to cancel schedule & retrieve unvested tokens.
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={state.paused}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl text-xs sm:text-sm transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              Create Vesting Schedule On-Chain
            </button>
          </form>
        </div>

        {/* Right Column: Deposit Tokens & Contract Info */}
        <div className="space-y-6">
          {/* Deposit Tokens Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ArrowDownCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Deposit ICO Tokens</h3>
                <p className="text-xs text-slate-400">Fund the Vault buffer for schedule allocation</p>
              </div>
            </div>

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Amount to Deposit
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={depositAmountInput}
                    onChange={(e) => setDepositAmountInput(e.target.value)}
                    placeholder="500000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 transition"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono text-slate-500">ICO</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                Deposit ICO Tokens to Vault
              </button>
            </form>
          </div>

          {/* Quick Contract Parameters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-xs font-mono space-y-3">
            <div className="font-bold text-slate-300 border-b border-slate-800 pb-2">
              Contract Metadata
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Token Contract:</span>
              <span className="text-slate-200">{state.tokenSymbol} ({state.tokenDecimals} decimals)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Vault Owner:</span>
              <span className="text-indigo-300">{state.owner.slice(0, 10)}...</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Active Schedules:</span>
              <span className="text-white font-bold">{state.schedules.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* All Schedules Management Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              All On-Chain Vesting Schedules ({state.schedules.length})
            </h3>
            <p className="text-xs text-slate-400">Overview of all active allocations across the system</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="py-3 px-3">Beneficiary</th>
                <th className="py-3 px-3">Total Amount</th>
                <th className="py-3 px-3">Vested / Released</th>
                <th className="py-3 px-3">Cliff Expiry</th>
                <th className="py-3 px-3">Revocable</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {state.schedules.map((schedule) => {
                const vestedNow = computeVestedAmount(schedule, currentTimestamp);
                const isInCliff = currentTimestamp < schedule.start + schedule.cliff;

                return (
                  <tr key={schedule.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-white">
                        {schedule.beneficiary.slice(0, 8)}...{schedule.beneficiary.slice(-6)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {accounts.find((a) => a.address.toLowerCase() === schedule.beneficiary.toLowerCase())?.label || 'External Address'}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-bold text-white">
                      {formatUnits(schedule.amountTotal)} ICO
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="text-indigo-300">{formatUnits(vestedNow)} Vested</div>
                      <div className="text-emerald-400">{formatUnits(schedule.released)} Released</div>
                    </td>

                    <td className="py-3.5 px-3 text-slate-400">
                      {new Date((schedule.start + schedule.cliff) * 1000).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-3">
                      {schedule.revocable ? (
                        <span className="text-amber-400">Yes</span>
                      ) : (
                        <span className="text-slate-500">Immutable</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3">
                      {schedule.revoked ? (
                        <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 rounded font-semibold">
                          Revoked
                        </span>
                      ) : isInCliff ? (
                        <span className="px-2 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded font-semibold">
                          Cliff Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded font-semibold">
                          Vesting
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      {schedule.revocable && !schedule.revoked ? (
                        <button
                          onClick={() => {
                            const res = onRevokeSchedule(schedule.id);
                            setFeedback({ type: res.success ? 'success' : 'error', text: res.message });
                          }}
                          className="px-2.5 py-1 bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 rounded text-[11px] transition cursor-pointer font-semibold"
                        >
                          Revoke
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[10px]">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
