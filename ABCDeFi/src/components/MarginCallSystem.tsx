import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Zap,
  TrendingDown,
  PlusCircle,
  Coins,
  CheckCircle2,
  BellRing,
  Loader2,
  Activity,
  Sliders,
  DollarSign,
} from 'lucide-react';
import {
  evaluateMarginCallRisk,
  executeLiquidation,
  topUpCollateral,
  repayLoan,
} from '../Services/lending';

interface MarginCallSystemProps {
  borrowerAddress?: string;
  collateralEth?: number;
  borrowedAbcd?: number;
  onRiskUpdate?: () => void;
}

export const MarginCallSystem: React.FC<MarginCallSystemProps> = ({
  borrowerAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  collateralEth = 5.0,
  borrowedAbcd = 7500,
  onRiskUpdate,
}) => {
  // Simulated ETH Price state for stress testing
  const [simulatedEthPrice, setSimulatedEthPrice] = useState<number>(2500);
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [notificationMsg, setNotificationMsg] = useState<string>('');

  // Top Up & Liquidation Modal Inputs
  const [topUpEthAmount, setTopUpEthAmount] = useState<string>('1.0');
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState<boolean>(false);

  // Evaluate live Margin Call Risk
  const riskStatus = evaluateMarginCallRisk(collateralEth, borrowedAbcd, simulatedEthPrice);

  // Handlers
  const handleTopUpCollateral = async () => {
    setTxLoading(true);
    setNotificationMsg('Depositing ETH Collateral to lower LTV and restore Health Factor...');
    try {
      await topUpCollateral(topUpEthAmount);
      setNotificationMsg(`Successfully deposited +${topUpEthAmount} ETH collateral! LTV restored.`);
      setIsTopUpModalOpen(false);
      if (onRiskUpdate) onRiskUpdate();
    } catch (err) {
      console.error(err);
      setNotificationMsg('Failed to deposit ETH collateral.');
    } finally {
      setTxLoading(false);
    }
  };

  const handleExecuteLiquidation = async () => {
    setTxLoading(true);
    setNotificationMsg(`Executing Liquidation for borrower ${borrowerAddress.substring(0, 6)}...`);
    try {
      await executeLiquidation(borrowerAddress, borrowedAbcd.toString());
      setNotificationMsg(`Successfully liquidated position! 5% liquidator incentive bonus claimed.`);
      if (onRiskUpdate) onRiskUpdate();
    } catch (err) {
      console.error(err);
      setNotificationMsg('Failed to execute liquidation.');
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div id="margin-call-system" className="space-y-6 font-mono">
      
      {/* HEADER & NOTIFICATION BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <span>Lending Risk Engine</span>
              <span className="text-slate-600">↓</span>
              <span>Step 5: Margin Call & Liquidation</span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Margin Call & Liquidation Engine
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated LTV monitoring (75% Warning, 85% Critical, 90% Liquidation Trigger) with Web3 risk alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3.5 py-1.5 rounded-2xl text-xs font-bold border flex items-center gap-1.5 ${
              riskStatus.isLiquidatable
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : riskStatus.isCritical
                ? 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
                : riskStatus.isWarning
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}>
              <BellRing className="w-3.5 h-3.5" />
              <span>Risk State: {riskStatus.riskLevel.toUpperCase()}</span>
            </span>
          </div>
        </div>

        {/* NOTIFICATION FEEDBACK */}
        {notificationMsg && (
          <div className="p-3.5 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {txLoading ? <Loader2 className="w-4 h-4 animate-spin text-rose-400" /> : <BellRing className="w-4 h-4 text-amber-400" />}
              <span>{notificationMsg}</span>
            </div>
            <button onClick={() => setNotificationMsg('')} className="text-slate-500 hover:text-white cursor-pointer">✕</button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. LTV THRESHOLD WARNING BANNER (75% THRESHOLD)                           */}
        {/* ========================================================================= */}
        {riskStatus.isWarning && !riskStatus.isCritical && !riskStatus.isLiquidatable && (
          <div className="p-4 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-amber-200">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 animate-bounce" />
              <div>
                <div className="text-sm font-bold text-amber-300 uppercase">Margin Call Warning – LTV Threshold Reached (75%)</div>
                <div className="text-xs text-amber-200/90 mt-0.5">
                  Your loan LTV ratio has reached <strong className="text-white">{riskStatus.ltvPercent}%</strong> (HF: {riskStatus.healthFactor}). Collateral price drops put your loan at risk.
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsTopUpModalOpen(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-md shadow-amber-500/20 whitespace-nowrap"
            >
              Top Up Collateral (+1.0 ETH)
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. CRITICAL WARNING ALERT BANNER (85% THRESHOLD)                          */}
        {/* ========================================================================= */}
        {riskStatus.isCritical && !riskStatus.isLiquidatable && (
          <div className="p-4 bg-red-950/60 border-2 border-red-500 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-red-200 animate-pulse">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-red-400 shrink-0" />
              <div>
                <div className="text-sm font-black text-red-300 uppercase tracking-wider">CRITICAL MARGIN CALL ALERT (85% LTV)</div>
                <div className="text-xs text-red-200/90 mt-0.5">
                  CRITICAL: LTV is at <strong className="text-white">{riskStatus.ltvPercent}%</strong> (HF: {riskStatus.healthFactor})! Immediate collateral deposit or debt repayment required to prevent liquidation.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <button
                onClick={() => setIsTopUpModalOpen(true)}
                className="bg-red-500 hover:bg-red-600 text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-md shadow-red-500/30"
              >
                Top Up Collateral
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. LIQUIDATION TRIGGER EXECUTION (90% / HF < 1.0 THRESHOLD)               */}
        {/* ========================================================================= */}
        {riskStatus.isLiquidatable && (
          <div className="p-5 bg-rose-950/80 border-2 border-rose-600 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-rose-100">
            <div className="flex items-center gap-3">
              <Flame className="w-8 h-8 text-rose-400 shrink-0 animate-pulse" />
              <div>
                <div className="text-sm font-black text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  <span>LIQUIDATION TRIGGER ACTIVE (LTV: {riskStatus.ltvPercent}%)</span>
                  <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px]">HF &lt; 1.00</span>
                </div>
                <div className="text-xs text-rose-200/90 mt-0.5">
                  This loan is undercollateralized! Liquidators can cover debt to claim ETH collateral with a <strong className="text-amber-300">5% liquidator bonus</strong>.
                </div>
              </div>
            </div>

            <button
              onClick={handleExecuteLiquidation}
              disabled={txLoading}
              className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black px-6 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-xl shadow-rose-600/40 whitespace-nowrap flex items-center gap-2"
            >
              {txLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
              <span>Execute Liquidation (Claim 5% Bonus)</span>
            </button>
          </div>
        )}

        {/* LTV RISK SPECTRUM GAUGE */}
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-300 font-bold">LTV Risk Spectrum Gauge</span>
            <span className="text-white font-bold font-mono">
              Current LTV: <strong className="text-amber-400">{riskStatus.ltvPercent}%</strong> (HF: {riskStatus.healthFactor})
            </span>
          </div>

          <div className="relative w-full h-4 bg-slate-900 border border-slate-800 rounded-full overflow-hidden flex">
            <div className="w-[75%] h-full bg-emerald-500/40 border-r border-amber-500/50" title="Safe Zone (<75%)" />
            <div className="w-[10%] h-full bg-amber-500/40 border-r border-red-500/50" title="Warning Zone (75-85%)" />
            <div className="w-[5%] h-full bg-red-500/40 border-r border-rose-500/50" title="Critical Zone (85-90%)" />
            <div className="w-[10%] h-full bg-rose-600/50" title="Liquidation Zone (>90%)" />

            {/* Current LTV Indicator Pin */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-lg shadow-white transition-all duration-300"
              style={{ left: `${Math.min(riskStatus.ltvPercent, 100)}%` }}
            />
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 font-mono">
            <span>0% Safe</span>
            <span className="text-amber-400 font-bold">75% Warning</span>
            <span className="text-red-400 font-bold">85% Critical</span>
            <span className="text-rose-400 font-bold">90% Liquidation</span>
          </div>
        </div>

        {/* ETH PRICE STRESS TESTER SLIDER */}
        <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-white">ETH Price Stress Tester</span>
            </div>
            <span className="text-xs font-bold text-emerald-400 font-mono">
              Simulated ETH Price: ${simulatedEthPrice.toLocaleString()} USD
            </span>
          </div>

          <input
            type="range"
            min="800"
            max="3500"
            step="50"
            value={simulatedEthPrice}
            onChange={(e) => setSimulatedEthPrice(Number(e.target.value))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />

          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>$800 (Crash)</span>
            <span>$1,600 (Warning)</span>
            <span>$2,500 (Normal)</span>
            <span>$3,500 (Bullish)</span>
          </div>
        </div>

      </div>

      {/* TOP UP COLLATERAL MODAL */}
      {isTopUpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase">Top Up Collateral</h3>
              </div>
              <button onClick={() => setIsTopUpModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Deposit ETH collateral to lower your LTV ratio and increase your Health Factor away from liquidation risk.
            </p>

            <div className="space-y-2">
              <label className="block text-slate-300 text-xs">ETH Collateral Deposit Amount</label>
              <input
                type="number"
                step="0.1"
                value={topUpEthAmount}
                onChange={(e) => setTopUpEthAmount(e.target.value)}
                placeholder="e.g. 1.0"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsTopUpModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUpCollateral}
                disabled={txLoading}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-2 rounded-xl text-xs transition cursor-pointer shadow-md shadow-amber-500/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {txLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                <span>Confirm Deposit (+{topUpEthAmount} ETH)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MarginCallSystem;
