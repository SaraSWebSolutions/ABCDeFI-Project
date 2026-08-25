import React, { useState } from 'react';
import { VestingSchedule, UserAccount } from '../types';
import { VestingChart } from './VestingChart';
import confetti from 'canvas-confetti';
import { Lock, Coins, Sparkles, CheckCircle2, Clock, AlertTriangle, ArrowRight, ShieldX, Eye } from 'lucide-react';

interface ClaimPortalProps {
  schedules: VestingSchedule[];
  selectedAccount: UserAccount;
  currentTimestamp: number;
  computeVestedAmount: (schedule: VestingSchedule, timestamp: number) => bigint;
  computeReleasableAmount: (schedule: VestingSchedule, timestamp?: number) => bigint;
  onClaim: (scheduleId: string) => void;
  formatUnits: (amount: bigint) => string;
  formatDuration: (seconds: number) => string;
  paused: boolean;
}

export const ClaimPortal: React.FC<ClaimPortalProps> = ({
  schedules,
  selectedAccount,
  currentTimestamp,
  computeVestedAmount,
  computeReleasableAmount,
  onClaim,
  formatUnits,
  formatDuration,
  paused,
}) => {
  const [selectedScheduleIdForChart, setSelectedScheduleIdForChart] = useState<string | null>(null);
  const [previewOffsetDays, setPreviewOffsetDays] = useState<number>(0);

  // Filter schedules for connected account
  const userSchedules = schedules.filter(
    (s) => s.beneficiary.toLowerCase() === selectedAccount.address.toLowerCase()
  );

  const previewTimestamp = currentTimestamp + previewOffsetDays * 86400;

  // Aggregate user statistics
  let totalAllocated = 0n;
  let totalClaimed = 0n;
  let totalReleasableNow = 0n;

  for (const s of userSchedules) {
    if (!s.revoked) {
      totalAllocated += s.amountTotal;
      totalClaimed += s.released;
      totalReleasableNow += computeReleasableAmount(s, currentTimestamp);
    }
  }

  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'],
      });
    } catch {
      // Ignore if confetti context missing
    }
  };

  const handleClaimClick = (scheduleId: string) => {
    onClaim(scheduleId);
    triggerConfetti();
  };

  return (
    <div className="space-[#1e293b] space-y-6">
      {/* Top Banner & Overview Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-3">
              <Coins className="w-3.5 h-3.5 text-indigo-400" />
              Beneficiary Claim Dashboard
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              ICO Token Vesting Portfolio
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Connected as <span className="text-indigo-300 font-semibold">{selectedAccount.label}</span>. Tokens vest according to cliff parameters and linear release schedules.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[320px]">
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400 font-mono uppercase">Total Vested Allocation</div>
              <div className="text-lg font-bold text-white font-mono mt-0.5">
                {formatUnits(totalAllocated)} <span className="text-xs text-slate-400">ICO</span>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-slate-400 font-mono uppercase">Total Tokens Claimed</div>
              <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                {formatUnits(totalClaimed)} <span className="text-xs text-slate-400">ICO</span>
              </div>
            </div>

            <div className="bg-indigo-950/60 border border-indigo-800/80 rounded-xl p-3.5 text-center">
              <div className="text-[11px] text-indigo-300 font-mono uppercase">Claimable Right Now</div>
              <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                {formatUnits(totalReleasableNow)} <span className="text-xs text-indigo-300">ICO</span>
              </div>
            </div>
          </div>
        </div>

        {/* Time Preview Simulator Slider */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/60 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-indigo-400" />
            <div>
              <div className="text-xs font-semibold text-white">Simulate Future Claimable Balance</div>
              <div className="text-xs text-slate-400">
                Drag slider to project vested tokens at +{previewOffsetDays} days in the future
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 max-w-md">
            <input
              type="range"
              min="0"
              max="365"
              step="1"
              value={previewOffsetDays}
              onChange={(e) => setPreviewOffsetDays(parseInt(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-950 px-2.5 py-1 rounded-lg border border-indigo-800/50 whitespace-nowrap">
              +{previewOffsetDays} days
            </span>
            {previewOffsetDays > 0 && (
              <button
                onClick={() => setPreviewOffsetDays(0)}
                className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Schedule List */}
      {userSchedules.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No Vesting Schedules Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            There are currently no active ICO vesting schedules allocated for wallet{' '}
            <span className="font-mono text-indigo-300">{selectedAccount.address}</span>. Switch accounts in the header or ask Admin to create a schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {userSchedules.map((schedule, idx) => {
            const cliffTimestamp = schedule.start + schedule.cliff;
            const endTimestamp = schedule.start + schedule.duration;

            const isInCliff = currentTimestamp < cliffTimestamp;
            const isFullyVested = currentTimestamp >= endTimestamp;

            const vestedNow = computeVestedAmount(schedule, currentTimestamp);
            const releasableNow = computeReleasableAmount(schedule, currentTimestamp);

            const previewVested = computeVestedAmount(schedule, previewTimestamp);
            const previewReleasable = computeReleasableAmount(schedule, previewTimestamp);

            // Progress Calculations
            const totalNum = Number(schedule.amountTotal);
            const claimedPct = totalNum > 0 ? (Number(schedule.released) / totalNum) * 100 : 0;
            const releasablePct = totalNum > 0 ? (Number(releasableNow) / totalNum) * 100 : 0;
            const unvestedPct = Math.max(0, 100 - claimedPct - releasablePct);

            return (
              <div
                key={schedule.id}
                className={`bg-slate-900 border rounded-2xl p-6 shadow-xl transition-all space-y-6 ${
                  schedule.revoked
                    ? 'border-red-900/50 bg-red-950/10'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Schedule Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-indigo-400 font-mono font-bold text-sm">
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-mono">
                          Schedule {schedule.id.slice(0, 10)}...{schedule.id.slice(-6)}
                        </span>

                        {/* Status Badges */}
                        {schedule.revoked ? (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/30 rounded-full flex items-center gap-1">
                            <ShieldX className="w-3 h-3" /> Revoked
                          </span>
                        ) : isInCliff ? (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" /> In Cliff Period
                          </span>
                        ) : isFullyVested ? (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> 100% Fully Vested
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full flex items-center gap-1 animate-pulse">
                            <Sparkles className="w-3 h-3" /> Actively Vesting
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Start: {new Date(schedule.start * 1000).toLocaleDateString()} | Duration: {formatDuration(schedule.duration)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setSelectedScheduleIdForChart(
                          selectedScheduleIdForChart === schedule.id ? null : schedule.id
                        )
                      }
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" />
                      {selectedScheduleIdForChart === schedule.id ? 'Hide Chart' : 'View Vesting Curve'}
                    </button>
                  </div>
                </div>

                {/* Progress Bar & Visual Token Meter */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">Token Unlock Distribution</span>
                    <span className="text-slate-200">
                      Total Allocation: <strong className="text-white">{formatUnits(schedule.amountTotal)} ICO</strong>
                    </span>
                  </div>

                  <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-slate-800">
                    {/* Claimed */}
                    <div
                      style={{ width: `${claimedPct}%` }}
                      className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                      title={`Claimed: ${formatUnits(schedule.released)} ICO`}
                    />
                    {/* Claimable */}
                    <div
                      style={{ width: `${releasablePct}%` }}
                      className="bg-amber-400 h-full transition-all duration-500 animate-pulse"
                      title={`Claimable Now: ${formatUnits(releasableNow)} ICO`}
                    />
                    {/* Unvested */}
                    <div
                      style={{ width: `${unvestedPct}%` }}
                      className="bg-slate-800 h-full rounded-r-full"
                      title={`Locked / Unvested: ${formatUnits(schedule.amountTotal - vestedNow)} ICO`}
                    />
                  </div>

                  {/* Meter Legend */}
                  <div className="grid grid-cols-3 gap-2 text-[11px] font-mono pt-1 text-center">
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-emerald-400 font-semibold">Claimed Tokens</div>
                      <div className="text-slate-200 font-bold">{formatUnits(schedule.released)} ICO</div>
                    </div>
                    <div className="bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">
                      <div className="text-amber-400 font-semibold">Claimable Right Now</div>
                      <div className="text-white font-bold">{formatUnits(releasableNow)} ICO</div>
                    </div>
                    <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div className="text-slate-400 font-semibold">Locked / Remaining</div>
                      <div className="text-slate-300 font-bold">
                        {formatUnits(schedule.amountTotal - schedule.released - releasableNow)} ICO
                      </div>
                    </div>
                  </div>
                </div>

                {/* Future Projection Box if previewOffsetDays > 0 */}
                {previewOffsetDays > 0 && (
                  <div className="bg-indigo-950/40 border border-indigo-800/50 p-3.5 rounded-xl flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2 text-indigo-300">
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                      <span>
                        Projected at +{previewOffsetDays} days ({new Date(previewTimestamp * 1000).toLocaleDateString()}):
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">Vested: </span>
                      <strong className="text-white">{formatUnits(previewVested)} ICO</strong>
                      <span className="text-slate-400 ml-3">Releasable: </span>
                      <strong className="text-amber-400">{formatUnits(previewReleasable)} ICO</strong>
                    </div>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                  <div className="text-xs text-slate-400 space-y-1">
                    <div>
                      <span className="text-slate-500 font-mono">Cliff Expiry: </span>
                      <strong className="text-slate-200">
                        {schedule.cliff === 0
                          ? 'No Cliff (Immediate Start)'
                          : `${new Date(cliffTimestamp * 1000).toLocaleDateString()} (${formatDuration(schedule.cliff)})`}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-mono">Release Interval: </span>
                      <strong className="text-slate-200">{formatDuration(schedule.slicePeriodSeconds)}</strong>
                      <span className="text-slate-500 font-mono ml-3">Revocable: </span>
                      <strong className={schedule.revocable ? 'text-amber-400' : 'text-emerald-400'}>
                        {schedule.revocable ? 'Yes (Admin Can Revoke Unvested)' : 'No (Immutable)'}
                      </strong>
                    </div>
                  </div>

                  <button
                    disabled={releasableNow <= 0n || schedule.revoked || paused}
                    onClick={() => handleClaimClick(schedule.id)}
                    className={`px-6 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg cursor-pointer ${
                      releasableNow > 0n && !schedule.revoked && !paused
                        ? 'bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 shadow-amber-500/20 active:scale-95'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    {paused
                      ? 'Vault Paused'
                      : schedule.revoked
                      ? 'Schedule Revoked'
                      : releasableNow > 0n
                      ? `Claim ${formatUnits(releasableNow)} ICO Tokens`
                      : isInCliff
                      ? 'Locked in Cliff Period'
                      : 'No Claimable Tokens'}
                    {releasableNow > 0n && !schedule.revoked && !paused && (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Inline Chart View toggle */}
                {selectedScheduleIdForChart === schedule.id && (
                  <div className="pt-4 border-t border-slate-800">
                    <VestingChart
                      schedule={schedule}
                      currentTimestamp={currentTimestamp}
                      computeVestedAmount={computeVestedAmount}
                      formatUnits={formatUnits}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
