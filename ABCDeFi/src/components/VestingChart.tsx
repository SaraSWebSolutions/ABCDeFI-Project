import React, { useMemo } from 'react';
import { VestingSchedule } from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface VestingChartProps {
  schedule: VestingSchedule;
  currentTimestamp: number;
  computeVestedAmount: (schedule: VestingSchedule, timestamp: number) => bigint;
  formatUnits: (amount: bigint) => string;
}

export const VestingChart: React.FC<VestingChartProps> = ({
  schedule,
  currentTimestamp,
  computeVestedAmount,
  formatUnits,
}) => {
  const chartData = useMemo(() => {
    const data = [];
    const totalDuration = schedule.duration;
    const steps = 40;
    const stepSize = Math.max(86400, Math.floor(totalDuration / steps));

    const startTime = schedule.start;
    const cliffTime = schedule.start + schedule.cliff;
    const endTime = schedule.start + schedule.duration;

    // Build timeline points including start, cliff, end, and current time
    const timestamps = new Set<number>();
    timestamps.add(startTime);
    if (cliffTime > startTime && cliffTime < endTime) {
      timestamps.add(cliffTime - 1); // point right before cliff
      timestamps.add(cliffTime);     // cliff point
    }
    timestamps.add(endTime);
    timestamps.add(currentTimestamp);

    for (let t = startTime; t <= endTime + stepSize * 2; t += stepSize) {
      timestamps.add(t);
    }

    const sortedTimestamps = Array.from(timestamps).sort((a, b) => a - b);

    const totalNum = Number(schedule.amountTotal) / 1e18;
    const currentReleasedNum = Number(schedule.released) / 1e18;

    for (const t of sortedTimestamps) {
      const vestedBig = computeVestedAmount(schedule, t);
      const vestedNum = Number(vestedBig) / 1e18;
      const releasableNum = Math.max(0, vestedNum - currentReleasedNum);

      const dateStr = new Date(t * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      data.push({
        timestamp: t,
        dateStr,
        Vested: parseFloat(vestedNum.toFixed(2)),
        Claimed: parseFloat(Math.min(currentReleasedNum, vestedNum).toFixed(2)),
        Claimable: parseFloat(releasableNum.toFixed(2)),
        TotalAllocated: parseFloat(totalNum.toFixed(2)),
        isCurrent: t === currentTimestamp,
      });
    }

    return data;
  }, [schedule, currentTimestamp, computeVestedAmount]);

  const cliffDate = new Date((schedule.start + schedule.cliff) * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const endDate = new Date((schedule.start + schedule.duration) * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <span>Vesting Trajectory & Cliff Unlock Curve</span>
            {schedule.cliff > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                Cliff: {Math.round(schedule.cliff / 86400)} Days
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-400">
            Linear accumulation schedule from {new Date(schedule.start * 1000).toLocaleDateString()} to {endDate}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
            <span className="text-slate-300">Vested</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span className="text-slate-300">Claimed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span className="text-slate-300">Claimable</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="vestedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="claimedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="dateStr" stroke="#64748b" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-slate-950 border border-slate-700 p-3 rounded-lg shadow-2xl text-xs font-mono space-y-1">
                      <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 flex justify-between gap-4">
                        <span>{data.dateStr}</span>
                        {data.timestamp === currentTimestamp && (
                          <span className="text-emerald-400 font-semibold">[Current Time]</span>
                        )}
                      </div>
                      <div className="text-indigo-300 flex justify-between gap-4">
                        <span>Vested Tokens:</span>
                        <span className="font-bold">{data.Vested.toLocaleString()} ICO</span>
                      </div>
                      <div className="text-emerald-400 flex justify-between gap-4">
                        <span>Claimed:</span>
                        <span className="font-bold">{data.Claimed.toLocaleString()} ICO</span>
                      </div>
                      <div className="text-amber-300 flex justify-between gap-4">
                        <span>Claimable Now:</span>
                        <span className="font-bold">{data.Claimable.toLocaleString()} ICO</span>
                      </div>
                      <div className="text-slate-500 flex justify-between gap-4">
                        <span>Total Allocated:</span>
                        <span>{data.TotalAllocated.toLocaleString()} ICO</span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            {/* Reference Line for Cliff End */}
            {schedule.cliff > 0 && (
              <ReferenceLine
                x={new Date((schedule.start + schedule.cliff) * 1000).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: `Cliff End (${cliffDate})`, fill: '#f59e0b', fontSize: 10, position: 'top' }}
              />
            )}

            {/* Reference Line for Current EVM Time */}
            <ReferenceLine
              x={new Date(currentTimestamp * 1000).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              stroke="#10b981"
              strokeWidth={2}
              label={{ value: 'NOW', fill: '#10b981', fontSize: 11, fontWeight: 'bold', position: 'insideTopLeft' }}
            />

            <Area type="monotone" dataKey="Vested" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#vestedGrad)" />
            <Area type="monotone" dataKey="Claimed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#claimedGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
