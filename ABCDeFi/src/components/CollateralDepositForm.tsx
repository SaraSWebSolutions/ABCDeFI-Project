import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '../Context/WalletContext';
import { CONTRACTS } from '../Config/contracts';
import { getAllowance } from '../Services/token';
import {
  depositTreasuryERC20,
  getTreasuryState,
  TreasuryState,
  treasuryErrorMessage,
  withdrawTreasuryERC20,
  withdrawTreasuryETH,
} from '../Services/treasury';

type TreasuryPanelMode = 'deposit' | 'withdraw';

interface TreasuryPanelProps {
  mode?: TreasuryPanelMode;
}

const isPositiveAmount = (amount: string) => /^\d+(?:\.\d+)?$/.test(amount) && Number(amount) > 0;

/** Kept at its active import path; this panel uses Treasury, not lending collateral. */
export const CollateralDepositForm: React.FC<TreasuryPanelProps> = ({ mode = 'deposit' }) => {
  const { address, balanceABCD, isConnected, isCorrectNetwork, refreshBalances } = useWallet();
  const [amount, setAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawRecipient, setWithdrawRecipient] = useState('');
  const [withdrawAsset, setWithdrawAsset] = useState<'ABCD' | 'ETH'>('ABCD');
  const [loading, setLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [withdrawHash, setWithdrawHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [treasuryState, setTreasuryState] = useState<TreasuryState | null>(null);
  const [allowance, setAllowance] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTreasuryData = useCallback(async () => {
    setIsRefreshing(true);
    setReadError(null);
    try {
      const [state, currentAllowance] = await Promise.all([
        getTreasuryState(address || undefined),
        address ? getAllowance(address, CONTRACTS.treasury) : Promise.resolve(null),
      ]);
      setTreasuryState(state);
      setAllowance(currentAllowance);
    } catch (readFailure) {
      setTreasuryState(null);
      setAllowance(null);
      setReadError(treasuryErrorMessage(readFailure));
    } finally {
      setIsRefreshing(false);
    }
  }, [address]);

  useEffect(() => {
    void refreshTreasuryData();
  }, [refreshTreasuryData]);

  const requireWritableWallet = () => {
    if (!isConnected || !address) throw new Error('Connect the wallet that holds the ABCD you want to use.');
    if (!isCorrectNetwork) throw new Error('Switch MetaMask to Hardhat Local (chain 31337) before using Treasury.');
    if (!treasuryState) throw new Error('Treasury state is unavailable. Refresh the canonical contract read before submitting a transaction.');
    if (treasuryState.isPaused) throw new Error('Treasury is paused. Deposits and withdrawals are unavailable.');
  };

  const handleDeposit = async (event: React.FormEvent) => {
    event.preventDefault();
    const requestedAmount = amount.trim();
    if (!isPositiveAmount(requestedAmount)) {
      setError('Enter an ABCD amount greater than zero.');
      return;
    }
    setError(null);
    setTxHash(null);
    setLoading(true);
    try {
      requireWritableWallet();
      const receipt = await depositTreasuryERC20(CONTRACTS.token, requestedAmount);
      setTxHash(receipt.hash);
      setAmount('');
      await Promise.all([refreshBalances(), refreshTreasuryData()]);
    } catch (depositFailure) {
      setError(treasuryErrorMessage(depositFailure));
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (event: React.FormEvent) => {
    event.preventDefault();
    const requestedAmount = withdrawAmount.trim();
    if (!isPositiveAmount(requestedAmount)) {
      setWithdrawError('Enter a withdrawal amount greater than zero.');
      return;
    }
    if (!withdrawRecipient.trim()) {
      setWithdrawError('Enter a recipient address.');
      return;
    }
    setWithdrawError(null);
    setWithdrawHash(null);
    setWithdrawLoading(true);
    try {
      requireWritableWallet();
      if (!treasuryState?.canWithdraw) throw new Error('The connected wallet does not have Treasury WITHDRAWER_ROLE.');
      const receipt = withdrawAsset === 'ABCD'
        ? await withdrawTreasuryERC20(CONTRACTS.token, withdrawRecipient.trim(), requestedAmount)
        : await withdrawTreasuryETH(withdrawRecipient.trim(), requestedAmount);
      setWithdrawHash(receipt.hash);
      setWithdrawAmount('');
      await Promise.all([refreshBalances(), refreshTreasuryData()]);
    } catch (withdrawFailure) {
      setWithdrawError(treasuryErrorMessage(withdrawFailure));
    } finally {
      setWithdrawLoading(false);
    }
  };

  const writesUnavailable = !isConnected || !isCorrectNetwork || !treasuryState || treasuryState.isPaused;
  const statusValue = isRefreshing ? 'Loading…' : treasuryState?.isPaused ? 'Paused' : treasuryState ? 'Active' : 'Unavailable';

  return (
    <div className="space-y-4">
      <section className="bg-gray-800 p-6 rounded-lg shadow-lg text-white max-w-3xl mx-auto">
        <div className="mb-4"><h2 className="text-2xl font-bold">Canonical Treasury</h2><p className="mt-1 text-sm text-gray-400">On-chain reads from the deployed Hardhat Local Treasury contract.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-xs">
          <ReadValue label="Treasury address" value={CONTRACTS.treasury} mono />
          <ReadValue label="Treasury ETH" value={isRefreshing ? 'Loading…' : treasuryState?.ethBalance ?? 'Unavailable'} suffix={treasuryState ? ' ETH' : ''} />
          <ReadValue label="Treasury ABCD" value={isRefreshing ? 'Loading…' : treasuryState?.abcdBalance ?? 'Unavailable'} suffix={treasuryState ? ' ABCD' : ''} />
          <ReadValue label="Reserve vault ETH" value={isRefreshing ? 'Loading…' : treasuryState?.reserveVaultBalance ?? 'Unavailable'} suffix={treasuryState ? ' ETH' : ''} />
          <ReadValue label="Interest pool ETH" value={isRefreshing ? 'Loading…' : treasuryState?.interestPoolBalance ?? 'Unavailable'} suffix={treasuryState ? ' ETH' : ''} />
          <ReadValue label="Burn pool ETH" value={isRefreshing ? 'Loading…' : treasuryState?.burnPoolBalance ?? 'Unavailable'} suffix={treasuryState ? ' ETH' : ''} />
          <ReadValue label="Distribution reports" value={isRefreshing ? 'Loading…' : treasuryState ? String(treasuryState.distributionReportCount) : 'Unavailable'} />
          <ReadValue label="Latest distribution" value={isRefreshing ? 'Loading…' : treasuryState?.latestDistributionAmount ?? (treasuryState ? 'None' : 'Unavailable')} suffix={treasuryState?.latestDistributionAmount ? ' ETH' : ''} />
          <ReadValue label="Treasury status" value={statusValue} />
          <ReadValue label="Your withdrawal role" value={!address ? 'Connect wallet to check' : isRefreshing ? 'Loading…' : treasuryState?.canWithdraw ? 'Authorized' : treasuryState ? 'Not authorized' : 'Unavailable'} />
          <ReadValue label="Your admin role" value={!address ? 'Connect wallet to check' : isRefreshing ? 'Loading…' : treasuryState?.canAdminister ? 'Authorized' : treasuryState ? 'Not authorized' : 'Unavailable'} />
        </div>
        <p className="mt-4 text-xs text-gray-500">The Treasury ABI exposes role checks for a supplied account, but does not expose enumerable administrator addresses.</p>
        {readError && <div className="mt-4 rounded border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">Treasury read failed: {readError}</div>}
      </section>

      {!isConnected && <Notice>Connect MetaMask on Hardhat Local to submit Treasury transactions. The balances above remain canonical read-only values.</Notice>}
      {isConnected && !isCorrectNetwork && <Notice>Switch MetaMask to Hardhat Local (chain 31337) before submitting Treasury transactions.</Notice>}
      {treasuryState?.isPaused && <Notice>Treasury is paused. Deposits and withdrawals are unavailable until an authorized pauser unpauses the deployed contract.</Notice>}

      {mode === 'deposit' && <section className="bg-gray-800 p-6 rounded-lg shadow-lg text-white max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-1">Deposit ABCD</h2><p className="text-sm text-gray-400 mb-4">Send ABCD to the canonical deployed Treasury. Approval is requested only when needed.</p>
        <form onSubmit={handleDeposit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Asset</label><div className="w-full bg-gray-700 rounded border border-gray-600 px-3 py-2 text-white">ABCD</div></div>
          <div><label className="block text-sm font-medium mb-1">Amount</label><input type="number" step="0.0001" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full bg-gray-700 rounded border border-gray-600 px-3 py-2 text-white" placeholder="0.00" disabled={writesUnavailable || loading} /></div>
          <div className="rounded border border-gray-700 bg-gray-900/70 p-3 text-xs text-gray-300 space-y-1"><div>Wallet ABCD: <span className="font-mono text-white">{balanceABCD ?? 'Unavailable'}</span></div><div>Current Treasury allowance: <span className="font-mono text-white">{isRefreshing ? 'Loading…' : allowance ?? 'Unavailable'} ABCD</span></div></div>
          {error && <div className="text-red-400 text-sm">{error}</div>}
          {txHash && <div className="text-green-400 text-sm break-all">ABCD Treasury deposit confirmed: {txHash}</div>}
          <button type="submit" disabled={writesUnavailable || loading} className={`w-full py-2 px-4 rounded font-bold ${writesUnavailable || loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>{loading ? 'Confirming transaction…' : 'Approve if needed & Deposit ABCD'}</button>
        </form>
      </section>}

      {mode === 'withdraw' && (treasuryState?.canWithdraw ? <section className="bg-gray-800 p-6 rounded-lg shadow-lg text-white max-w-md mx-auto">
        <h2 className="text-2xl font-bold mb-1">Authorized Treasury Withdrawal</h2><p className="text-sm text-gray-400 mb-4">Visible because the connected wallet has Treasury WITHDRAWER_ROLE.</p>
        <form onSubmit={handleWithdrawal} className="space-y-4">
          <select value={withdrawAsset} onChange={(event) => setWithdrawAsset(event.target.value as 'ABCD' | 'ETH')} className="w-full bg-gray-700 rounded border border-gray-600 px-3 py-2 text-white" disabled={writesUnavailable || withdrawLoading}><option value="ABCD">ABCD</option><option value="ETH">ETH</option></select>
          <input value={withdrawRecipient} onChange={(event) => setWithdrawRecipient(event.target.value)} placeholder="Recipient address (0x...)" className="w-full bg-gray-700 rounded border border-gray-600 px-3 py-2 text-white" disabled={writesUnavailable || withdrawLoading} />
          <input type="number" step="0.0001" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder={`${withdrawAsset} amount`} className="w-full bg-gray-700 rounded border border-gray-600 px-3 py-2 text-white" disabled={writesUnavailable || withdrawLoading} />
          {withdrawError && <div className="text-red-400 text-sm">{withdrawError}</div>}
          {withdrawHash && <div className="text-green-400 text-sm break-all">{withdrawAsset} Treasury withdrawal confirmed: {withdrawHash}</div>}
          <button type="submit" disabled={writesUnavailable || withdrawLoading} className={`w-full py-2 px-4 rounded font-bold ${writesUnavailable || withdrawLoading ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'}`}>{withdrawLoading ? 'Confirming transaction…' : `Withdraw ${withdrawAsset}`}</button>
        </form>
      </section> : <section className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 text-center"><h3 className="text-sm font-bold text-white">Treasury withdrawal unavailable</h3><p className="text-xs text-slate-400">The deployed contract restricts withdrawals to accounts with WITHDRAWER_ROLE. The connected account is not authorized, or no wallet is connected.</p></section>)}
    </div>
  );
};

const ReadValue = ({ label, value, suffix = '', mono = false }: { label: string; value: string; suffix?: string; mono?: boolean }) => <div className="rounded border border-gray-700 bg-gray-900/70 p-3"><div className="text-[10px] uppercase text-gray-500">{label}</div><div className={`mt-1 break-all text-sm text-white ${mono ? 'font-mono' : ''}`}>{value}{suffix}</div></div>;
const Notice: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="max-w-3xl mx-auto rounded border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">{children}</div>;
