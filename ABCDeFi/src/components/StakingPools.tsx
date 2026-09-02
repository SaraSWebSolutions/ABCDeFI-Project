import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits, parseEther } from 'ethers';
import { AlertTriangle, CheckCircle2, Clock, Coins, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import {
  approveStaking,
  claimStakingRewards,
  getStakingInfo,
  stakeTokens,
  stakingErrorMessage,
  type StakingData,
  unstakeTokens,
} from '../Services/staking';

type TransactionStatus = 'idle' | 'validating' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

const formatDate = (timestamp: bigint) => new Date(Number(timestamp) * 1000).toLocaleString();
const formatDuration = (seconds: number) => `${seconds / 86400} days`;

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
    <div className="text-[10px] uppercase text-slate-500">{label}</div>
    <div className="mt-1 break-words font-mono text-slate-100">{value}</div>
  </div>
);

export const StakingPools: React.FC = () => {
  const { address, isConnected, isCorrectNetwork, refreshBalances } = useWallet();
  const [staking, setStaking] = useState<StakingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [amount, setAmount] = useState('100');
  const [lockDuration, setLockDuration] = useState<number | null>(null);
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [message, setMessage] = useState('');
  const [approvalHash, setApprovalHash] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);

  const loadStaking = useCallback(async () => {
    if (!address) {
      setStaking(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const next = await getStakingInfo(address);
      setStaking(next);
      setLockDuration((current) => current ?? next.tiers[0]?.lockDuration ?? null);
    } catch (error) {
      console.error('Failed to load on-chain staking state:', error);
      setStaking(null);
      setStatus('error');
      setMessage('Unable to read the StakingPool contract on the configured network.');
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void loadStaking();
  }, [loadStaking]);

  const isPending = status === 'validating' || status === 'awaiting-wallet' || status === 'confirming';
  const selectedTier = useMemo(
    () => staking?.tiers.find((tier) => tier.lockDuration === lockDuration) ?? null,
    [lockDuration, staking],
  );

  const handleStake = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;
    setStatus('validating');
    setMessage('Validating stake amount, token balance, allowance, and lock tier...');
    setApprovalHash(null);
    setTransactionHash(null);

    if (!isConnected || !address) {
      setStatus('error');
      setMessage('Connect the wallet that will stake ABCD.');
      return;
    }
    if (!isCorrectNetwork) {
      setStatus('error');
      setMessage('Switch MetaMask to Hardhat Local (chain 31337) before staking.');
      return;
    }
    if (!staking || staking.paused || !selectedTier || selectedTier.rewardMultiplierBps === 0n) {
      setStatus('error');
      setMessage(staking?.paused ? 'The StakingPool is paused on-chain.' : 'Select an available on-chain lock tier.');
      return;
    }

    let value: bigint;
    try {
      value = parseEther(amount);
    } catch {
      setStatus('error');
      setMessage('Enter a valid ABCD amount.');
      return;
    }
    if (value <= 0n) {
      setStatus('error');
      setMessage('Stake amount must be greater than zero.');
      return;
    }
    if (value > parseEther(staking.walletBalance)) {
      setStatus('error');
      setMessage(`Insufficient ABCD balance. Available: ${staking.walletBalance} ABCD.`);
      return;
    }

    try {
      if (value > parseEther(staking.allowance)) {
        setStatus('awaiting-wallet');
        setMessage('Approve the StakingPool to transfer ABCD in your wallet.');
        await approveStaking(amount, (hash) => {
          setApprovalHash(hash);
          setStatus('confirming');
          setMessage('ABCD approval submitted. Waiting for confirmation...');
        });
      }

      setStatus('awaiting-wallet');
      setMessage('Confirm the ABCD staking transaction in your wallet.');
      const receipt = await stakeTokens(amount, selectedTier.lockDuration, (hash) => {
        setTransactionHash(hash);
        setStatus('confirming');
        setMessage('Stake submitted. Waiting for on-chain confirmation...');
      });

      setTransactionHash(receipt.hash);
      setStatus('success');
      setMessage(`Stake confirmed in block ${receipt.blockNumber}.`);
      await Promise.all([loadStaking(), refreshBalances()]);
    } catch (error: unknown) {
      console.error('Staking transaction failed:', error);
      setStatus('error');
      setMessage(stakingErrorMessage(error));
    }
  };

  const runPositionAction = async (positionIndex: number, kind: 'unstake' | 'claim') => {
    if (isPending || !staking) return;
    if (!isConnected || !address) {
      setStatus('error');
      setMessage('Connect the wallet that owns this staking position.');
      return;
    }
    if (!isCorrectNetwork) {
      setStatus('error');
      setMessage('Switch MetaMask to Hardhat Local (chain 31337) before using this position.');
      return;
    }
    const position = staking.positions[positionIndex];
    if (!position || position.amountRaw === 0n) return;
    if (kind === 'unstake' && !position.isUnlocked) {
      setStatus('error');
      setMessage(`This position is locked until ${formatDate(position.unlockTime)}.`);
      return;
    }
    if (kind === 'claim' && position.pendingRewardsRaw === 0n) {
      setStatus('error');
      setMessage('There are no claimable rewards for this position.');
      return;
    }

    setApprovalHash(null);
    setTransactionHash(null);
    setStatus('awaiting-wallet');
    setMessage(`Confirm ${kind === 'unstake' ? 'unstake' : 'reward claim'} in your wallet.`);
    try {
      const receipt = await (kind === 'unstake'
        ? unstakeTokens(positionIndex, (hash) => {
            setTransactionHash(hash); setStatus('confirming'); setMessage('Unstake submitted. Waiting for on-chain confirmation...');
          })
        : claimStakingRewards(positionIndex, (hash) => {
            setTransactionHash(hash); setStatus('confirming'); setMessage('Reward claim submitted. Waiting for on-chain confirmation...');
          }));
      setTransactionHash(receipt.hash);
      setStatus('success');
      setMessage(`${kind === 'unstake' ? 'Unstake' : 'Reward claim'} confirmed in block ${receipt.blockNumber}.`);
      await Promise.all([loadStaking(), refreshBalances()]);
    } catch (error: unknown) {
      console.error(`Staking ${kind} failed:`, error);
      setStatus('error');
      setMessage(stakingErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-300"><Coins className="h-4 w-4" /> On-chain ABCD StakingPool</div>
            <h1 className="text-3xl font-extrabold text-white">Stake ABCD</h1>
            <p className="mt-2 text-sm text-slate-400">Only the deployed ABCD StakingPool is shown. APY and rewards are read from the contract.</p>
          </div>
          <button type="button" onClick={() => void loadStaking()} disabled={isLoading || isPending} className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>

        {isLoading ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading StakingPool contract…</div> : !staking ? <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">Staking state is unavailable. Connect a wallet on Hardhat Local and refresh.</div> : (
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Metric label="Wallet ABCD" value={`${staking.walletBalance} ABCD`} />
            <Metric label="Pool reward reserve" value={`${staking.rewardPoolBalance} ABCD`} />
            <Metric label="Total staked" value="Unavailable" />
            <Metric label="Pool status" value={staking.paused ? 'Paused' : 'Active'} />
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><ShieldCheck className="h-5 w-5 text-emerald-400" /> New ABCD stake</h2>
          <form className="mt-5 space-y-4" onSubmit={handleStake}>
            <label htmlFor="staking-amount" className="block text-xs font-semibold text-slate-300">Amount (ABCD)</label>
            <input id="staking-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={isPending} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-white outline-none focus:border-emerald-500 disabled:opacity-60" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {staking?.tiers.map((tier) => (
                <button key={tier.lockDuration} type="button" disabled={isPending} onClick={() => setLockDuration(tier.lockDuration)} className={`rounded-xl border p-3 text-left text-xs ${lockDuration === tier.lockDuration ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-300'}`}>
                  <div className="font-bold">{formatDuration(tier.lockDuration)}</div>
                  <div className="mt-1 font-mono">{formatUnits(tier.rewardMultiplierBps, 2)}% APY</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400">The contract has no minimum or maximum stake variable; it accepts non-zero ABCD amounts for supported lock tiers.</p>
            {!isConnected && <p className="text-xs text-slate-400">Connect a wallet to stake ABCD.</p>}
            {isConnected && !isCorrectNetwork && <p className="text-xs text-amber-300">Switch MetaMask to Hardhat Local (chain 31337) to stake ABCD.</p>}
            <button type="submit" disabled={isPending || !isConnected || !isCorrectNetwork || !selectedTier || !staking || staking.paused} className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              {status === 'validating' ? 'Validating…' : status === 'awaiting-wallet' ? 'Confirm in Wallet…' : status === 'confirming' ? 'Confirming on-chain…' : 'Approve and Stake ABCD'}
            </button>
          </form>
          {status !== 'idle' && <div className={`mt-4 rounded-xl border p-4 text-xs ${status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : status === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
            <div className="flex gap-2">{isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : status === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<span>{message}</span></div>
            {approvalHash && <div className="mt-2 break-all font-mono">Approval hash: {approvalHash}</div>}
            {transactionHash && <div className="mt-2 break-all font-mono">Transaction hash: {transactionHash}</div>}
          </div>}
        </section>

        <section className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Clock className="h-5 w-5 text-amber-400" /> Your positions</h2>
          {!address ? <p className="mt-5 text-sm text-slate-400">Connect a wallet to read staking positions.</p> : staking?.positions.filter((position) => position.amountRaw > 0n).length === 0 ? <p className="mt-5 text-sm text-slate-400">No active on-chain ABCD stakes.</p> : (
            <div className="mt-5 space-y-3">
              {staking?.positions.filter((position) => position.amountRaw > 0n).map((position) => (
                <div key={position.index} className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
                  <div className="flex justify-between gap-3"><span className="text-slate-400">Position #{position.index}</span><span className="font-mono text-emerald-300">{position.amount} ABCD</span></div>
                  <div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">On-chain APY</span><span>{formatUnits(position.rewardMultiplierBps, 2)}%</span></div>
                  <div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">Claimable reward</span><span>{position.pendingRewards} ABCD</span></div>
                  <div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">Started</span><span>{formatDate(position.startTime)}</span></div>
                  <div className="mt-2 flex justify-between gap-3"><span className="text-slate-400">Lock period</span><span>{formatDuration(Number(position.lockDuration))}</span></div>
                  <div className="mt-2 text-slate-400">{position.isUnlocked ? 'Unlocked' : `Locked until ${formatDate(position.unlockTime)}`}</div>
                  <div className="mt-3 flex gap-2"><button type="button" onClick={() => void runPositionAction(position.index, 'claim')} disabled={isPending || !isCorrectNetwork || position.pendingRewardsRaw === 0n} className="flex-1 rounded-lg bg-slate-800 px-2 py-2 font-bold text-slate-100 disabled:opacity-40">Claim</button><button type="button" onClick={() => void runPositionAction(position.index, 'unstake')} disabled={isPending || !isCorrectNetwork || !position.isUnlocked} className="flex-1 rounded-lg bg-rose-600 px-2 py-2 font-bold text-white disabled:opacity-40">Unstake</button></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default StakingPools;
