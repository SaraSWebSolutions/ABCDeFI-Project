import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Calculator, CheckCircle2, Coins, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { formatEther } from "ethers";
import {
  calculateEmiDetails,
  getLoanAndEmi,
  getLoanHistoryOnChain,
  payLoanEmi,
} from "../Services/lending";
import { useWallet } from "../Context/WalletContext";

interface EMISystemProps {
  loanId?: string;
  onEmiPaid?: () => void;
}

function normalizeStatus(status: bigint | number): string {
  const value = Number(status);
  switch (value) {
    case 1:
      return "REPAID";
    case 2:
      return "DEFAULTED";
    case 3:
      return "LIQUIDATED";
    default:
      return "ACTIVE";
  }
}

export const EMISystem: React.FC<EMISystemProps> = ({ loanId: requestedLoanId, onEmiPaid }) => {
  const { address: connectedAddress } = useWallet();
  const [activeLoanId, setActiveLoanId] = useState<string | null>(requestedLoanId ?? null);
  const [loan, setLoan] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [nextIndex, setNextIndex] = useState(0);
  const [defaulted, setDefaulted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [calcPrincipal, setCalcPrincipal] = useState("100");
  const [calcApyBps, setCalcApyBps] = useState(925);
  const [calcMonths, setCalcMonths] = useState(3);

  const calculatedEmi = useMemo(
    () => calculateEmiDetails(Number(calcPrincipal) || 0, calcApyBps, calcMonths),
    [calcPrincipal, calcApyBps, calcMonths]
  );

  const loadLoan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let targetLoanId = activeLoanId;
      if (!targetLoanId) {
        if (!connectedAddress) {
          setLoan(null);
          setSchedule([]);
          return;
        }
        const history = await getLoanHistoryOnChain(connectedAddress);
        if (!history.length) {
          setLoan(null);
          setSchedule([]);
          return;
        }
        targetLoanId = history[history.length - 1].loanId.toString();
        setActiveLoanId(targetLoanId);
      }

      const result = await getLoanAndEmi(targetLoanId!);
      setLoan(result.loan);
      setSchedule(result.schedule);
      setNextIndex(result.nextIndex);
      setDefaulted(result.defaulted);
    } catch (err: any) {
      setError(err?.shortMessage || err?.reason || err?.message || "Unable to load on-chain EMI data.");
    } finally {
      setLoading(false);
    }
  }, [activeLoanId, connectedAddress]);

  useEffect(() => {
    void loadLoan();
  }, [loadLoan]);

  const currentInstallment = nextIndex < schedule.length ? schedule[nextIndex] : null;
  const status = loan ? normalizeStatus(loan.status) : "NO LOAN";

  const handlePay = async () => {
    if (!activeLoanId || !currentInstallment) return;
    try {
      setPaying(true);
      setError(null);
      setMessage("Awaiting wallet confirmation...");
      const receipt = await payLoanEmi(activeLoanId);
      setMessage(`EMI confirmed: ${receipt.hash}`);
      await loadLoan();
      onEmiPaid?.();
    } catch (err: any) {
      setError(err?.shortMessage || err?.reason || err?.message || "EMI payment failed.");
      setMessage(null);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div id="emi-system" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider text-emerald-400">Lending Protocol → EMI</div>
          <h2 className="text-xl font-black text-white flex items-center gap-2 mt-1">
            <Calculator className="w-5 h-5 text-emerald-400" />
            Live EMI Dashboard
          </h2>
          <p className="text-xs text-slate-400 mt-1">All loan and installment values below are read from the deployed smart contracts.</p>
        </div>
        <button onClick={() => void loadLoan()} disabled={loading || paying} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 text-xs font-bold disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-200 flex gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
      {message && <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/40 p-4 text-xs text-emerald-200 break-all">{message}</div>}

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading live loan data…</div>
      ) : !loan ? (
        <div className="py-12 text-center text-slate-400 text-sm">No on-chain loan was found for the connected wallet.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Metric label="Loan ID" value={`#${loan.loanId.toString()}`} />
            <Metric label="Principal" value={`${formatEther(loan.principal)} ABCD`} />
            <Metric label="Total Repaid" value={`${formatEther(loan.totalRepaid)} ABCD`} />
            <Metric label="EMI" value={`${formatEther(loan.emiAmount)} ABCD`} />
            <Metric label="Status" value={status} />
          </div>

          {defaulted && <div className="rounded-xl border border-rose-700/60 bg-rose-950/40 p-4 text-xs text-rose-200">This loan is currently past its configured default/grace condition.</div>}

          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="text-sm font-bold text-white">On-chain EMI Schedule</div>
              <div className="text-xs text-slate-500">Next index: {nextIndex}</div>
            </div>
            <div className="divide-y divide-slate-800/70">
              {schedule.map((item, index) => (
                <div key={item.installmentId.toString()} className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                  <div className="font-bold text-white">#{item.installmentId.toString()}</div>
                  <div className="text-sm text-emerald-400 font-semibold">{formatEther(item.amount)} ABCD</div>
                  <div className="text-xs text-slate-400 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(Number(item.dueDate) * 1000).toLocaleDateString()}</div>
                  <div className="text-xs font-bold">
                    {item.isPaid ? <span className="text-emerald-400 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Paid</span> : index === nextIndex ? <span className="text-amber-400">Next Due</span> : <span className="text-slate-500">Upcoming</span>}
                  </div>
                  <div className="md:text-right">{index === nextIndex && !item.isPaid && status === "ACTIVE" ? <button onClick={handlePay} disabled={paying} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-black disabled:opacity-50"><Coins className="w-4 h-4" />{paying ? "Processing…" : `Pay ${formatEther(item.amount)} ABCD`}</button> : null}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="text-sm font-bold text-white">EMI Calculator</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input value={calcPrincipal} onChange={(e) => setCalcPrincipal(e.target.value)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" placeholder="Principal ABCD" />
          <input value={calcApyBps} onChange={(e) => setCalcApyBps(Number(e.target.value) || 0)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" placeholder="Interest BPS" />
          <input value={calcMonths} onChange={(e) => setCalcMonths(Number(e.target.value) || 1)} className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white" placeholder="Months" />
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <Metric label="Estimated EMI" value={`${calculatedEmi.monthlyEmi.toFixed(6)} ABCD`} />
          <Metric label="Interest" value={`${calculatedEmi.totalInterest.toFixed(6)} ABCD`} />
          <Metric label="Total" value={`${calculatedEmi.totalPayable.toFixed(6)} ABCD`} />
        </div>
      </div>
    </div>
  );
};

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bg-slate-950 border border-slate-800 p-4 rounded-2xl"><div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div><div className="text-sm font-extrabold text-white mt-1 break-all">{value}</div></div>;
}

export default EMISystem;
