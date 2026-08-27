import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, parseEther } from 'ethers';
import { AlertTriangle, CheckCircle2, Clock, Coins, Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import { buyTokens, claimPresaleTokens, getPresaleData, presaleErrorMessage, type PresaleData } from '../Services/presale';
import { CONTRACTS } from '../Config/contracts';

type PurchaseStatus = 'idle' | 'validating' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

const formatDate = (timestamp: bigint) =>
  timestamp === 0n ? 'Not scheduled' : new Date(Number(timestamp) * 1000).toLocaleString();
const sameAddress = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left && right && left.toLowerCase() === right.toLowerCase());
const sameWalletIdentity = (left: string | null | undefined, right: string | null | undefined) =>
  (!left && !right) || sameAddress(left, right);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
    <div className="text-[10px] uppercase text-slate-500">{label}</div>
    <div className="mt-1 break-words font-mono text-slate-100">{value}</div>
  </div>
);

export const PresaleICO: React.FC = () => {
  const { address, isConnected, isCorrectNetwork, refreshBalances } = useWallet();
  const [presale, setPresale] = useState<PresaleData | null>(null);
  const [readForAddress, setReadForAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [ethAmount, setEthAmount] = useState('0.1');
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [message, setMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const currentAddressRef = useRef(address);
  const readSequence = useRef(0);

  currentAddressRef.current = address;

  const loadPresale = useCallback(async () => {
    const sequence = ++readSequence.current;
    const requestedAddress = address;
    setIsLoading(true);
    try {
      const data = await getPresaleData(requestedAddress ?? undefined);
      if (sequence !== readSequence.current || !sameWalletIdentity(currentAddressRef.current, requestedAddress)) return;
      setPresale(data);
      setReadForAddress(requestedAddress);
    } catch (error) {
      if (sequence !== readSequence.current || !sameWalletIdentity(currentAddressRef.current, requestedAddress)) return;
      console.error('Failed to load on-chain presale state:', error);
      setPresale(null);
      setReadForAddress(null);
      setMessage(presaleErrorMessage(error));
      setStatus('error');
    } finally {
      if (sequence === readSequence.current) setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void loadPresale();
  }, [loadPresale]);

  const expectedTokens = useMemo(() => {
    if (!presale) return null;
    try {
      return formatUnits((parseEther(ethAmount || '0') * presale.rateRaw) / 10n ** 18n, 18);
    } catch {
      return null;
    }
  }, [ethAmount, presale]);

  const isPending = status === 'validating' || status === 'awaiting-wallet' || status === 'confirming';
  const hasCurrentBuyerRead = Boolean(address && sameAddress(readForAddress, address));
  const buyer = hasCurrentBuyerRead ? presale?.buyer ?? null : null;

  const handlePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isPending) return;

    setStatus('validating');
    setMessage('Validating the live presale state and contribution amount...');
    setTransactionHash(null);

    if (!isConnected || !address) {
      setStatus('error');
      setMessage('Connect the purchasing wallet before contributing.');
      return;
    }
    if (!isCorrectNetwork) {
      setStatus('error');
      setMessage('Switch MetaMask to Hardhat Local (chain 31337) before contributing.');
      return;
    }
    if (!presale || presale.status !== 'Active') {
      setStatus('error');
      setMessage(`Presale purchases are unavailable while the on-chain sale is ${presale?.status ?? 'unavailable'}.`);
      return;
    }

    let value: bigint;
    try {
      value = parseEther(ethAmount);
    } catch {
      setStatus('error');
      setMessage('Enter a valid ETH contribution amount.');
      return;
    }
    if (value <= 0n || value < parseEther(presale.minBuy) || value > parseEther(presale.maxBuy)) {
      setStatus('error');
      setMessage(`Contribution must be between ${presale.minBuy} and ${presale.maxBuy} ETH.`);
      return;
    }
    if (value > parseEther(presale.remainingEthCapacity)) {
      setStatus('error');
      setMessage(`Only ${presale.remainingEthCapacity} ETH of hard-cap capacity remains.`);
      return;
    }
    if (presale.whitelistRequired && !presale.buyer?.isWhitelisted) {
      setStatus('error');
      setMessage('This presale requires a whitelisted wallet address.');
      return;
    }
    if (buyer && parseEther(buyer.ethContributed) + value > parseEther(presale.maxBuy)) {
      setStatus('error');
      setMessage(`This wallet would exceed the ${presale.maxBuy} ETH per-wallet limit.`);
      return;
    }
    try {
      setStatus('awaiting-wallet');
      setMessage('Confirm the ETH contribution in your wallet.');
      const receipt = await buyTokens(ethAmount, (hash) => {
        setTransactionHash(hash);
        setStatus('confirming');
        setMessage('Contribution submitted. Waiting for on-chain confirmation...');
      });
      setTransactionHash(receipt.hash);
      setStatus('success');
      setMessage(`Presale contribution confirmed in block ${receipt.blockNumber}. Your allocation is claimable only after finalization.`);
      await Promise.all([loadPresale(), refreshBalances()]);
    } catch (error: unknown) {
      console.error('Presale purchase failed:', error);
      setStatus('error');
      setMessage(presaleErrorMessage(error));
    }
  };

  const handleClaim = async () => {
    if (isPending) return;
    setTransactionHash(null);
    if (!isConnected || !address) {
      setStatus('error');
      setMessage('Connect the purchasing wallet before claiming ABCD.');
      return;
    }
    if (!isCorrectNetwork) {
      setStatus('error');
      setMessage('Switch MetaMask to Hardhat Local (chain 31337) before claiming ABCD.');
      return;
    }
    if (!buyer || presale?.status !== 'Finalized' || buyer.claimed || parseEther(buyer.tokensPurchased) === 0n) {
      setStatus('error');
      setMessage('There are no claimable Presale tokens for this wallet.');
      return;
    }
    try {
      setStatus('awaiting-wallet');
      setMessage('Confirm the ABCD claim in your wallet.');
      const receipt = await claimPresaleTokens((hash) => {
        setTransactionHash(hash);
        setStatus('confirming');
        setMessage('Claim submitted. Waiting for on-chain confirmation...');
      });
      setTransactionHash(receipt.hash);
      setStatus('success');
      setMessage(`ABCD claim confirmed in block ${receipt.blockNumber}.`);
      await Promise.all([loadPresale(), refreshBalances()]);
    } catch (error: unknown) {
      console.error('Presale claim failed:', error);
      setStatus('error');
      setMessage(presaleErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-300"><Coins className="h-4 w-4" /> On-chain ABCD Presale</div>
            <h1 className="text-3xl font-extrabold text-white">Purchase ABCD with ETH</h1>
            <p className="mt-2 text-sm text-slate-400">All values below come from the deployed Presale contract on the configured network.</p>
          </div>
          <button type="button" onClick={() => void loadPresale()} disabled={isLoading || isPending} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh on-chain state
          </button>
        </div>

        {isLoading ? <div className="mt-6 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Reading Presale contract…</div> : presale && (
          <>
            {presale.status === 'Pending' && (
              <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                Presale has not started. An authorized Presale administrator must start it before contributions can be accepted.
              </div>
            )}
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Metric label="Sale state" value={presale.status} />
              <Metric label="Canonical Presale" value={CONTRACTS.presale} />
              <Metric label="Rate" value={`${presale.rateAbcdPerEth} ABCD / ETH`} />
              <Metric label="Soft cap" value={`${presale.softCap} ETH`} />
              <Metric label="Raised / hard cap" value={`${presale.totalEthRaised} / ${presale.hardCap} ETH`} />
              <Metric label="Remaining capacity" value={`${presale.remainingEthCapacity} ETH`} />
              <Metric label="Contribution range" value={`${presale.minBuy}–${presale.maxBuy} ETH`} />
              <Metric label="ABCD sold" value={`${presale.totalTokensSold} ABCD`} />
              <Metric label="Presale token reserve" value={`${presale.tokenReserve} ABCD`} />
              <Metric label="Contract pause state" value={presale.isPaused ? 'Paused' : 'Unpaused'} />
              <Metric label="Finalized / cancelled" value={`${presale.isFinalized ? 'Yes' : 'No'} / ${presale.isCancelled ? 'Yes' : 'No'}`} />
              <Metric label="Start" value={formatDate(presale.startTime)} />
              <Metric label="End" value={formatDate(presale.endTime)} />
            </div>
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><Wallet className="h-5 w-5 text-amber-400" /> ETH contribution</h2>
          <form className="mt-5 space-y-4" onSubmit={handlePurchase}>
            <label className="block text-xs font-semibold text-slate-300" htmlFor="presale-eth-amount">Amount (ETH)</label>
            <input id="presale-eth-amount" inputMode="decimal" value={ethAmount} onChange={(event) => setEthAmount(event.target.value)} disabled={isPending} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-mono text-white outline-none focus:border-amber-500 disabled:opacity-60" />
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
              <div className="flex justify-between gap-4"><span className="text-slate-400">Expected allocation at on-chain rate</span><span className="font-bold text-emerald-300">{expectedTokens === null ? 'Unavailable' : `${expectedTokens} ABCD`}</span></div>
            </div>
            {!isConnected && <p className="text-xs text-slate-400">Connect a wallet to contribute.</p>}
            {isConnected && !isCorrectNetwork && <p className="text-xs text-amber-300">Switch MetaMask to Hardhat Local (chain 31337) to contribute.</p>}
            <button type="submit" disabled={isPending || !isConnected || !isCorrectNetwork || !presale || presale.status !== 'Active' || presale.isPaused} className="w-full rounded-xl bg-amber-400 py-3.5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
              {status === 'validating' ? 'Validating…' : status === 'awaiting-wallet' ? 'Confirm in Wallet…' : status === 'confirming' ? 'Confirming on-chain…' : presale?.isPaused ? 'Presale Paused' : presale?.status === 'Active' ? 'Buy ABCD with ETH' : presale?.status === 'Pending' ? 'Presale has not started' : `Presale ${presale?.status ?? 'Unavailable'}`}
            </button>
          </form>
          {status !== 'idle' && <div className={`mt-4 rounded-xl border p-4 text-xs ${status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : status === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
            <div className="flex gap-2">{isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : status === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<span>{message}</span></div>
            {transactionHash && <div className="mt-2 break-all font-mono">Transaction hash: {transactionHash}</div>}
          </div>}
        </section>

        <section className="lg:col-span-2 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h2 className="flex items-center gap-2 text-lg font-bold text-white"><ShieldCheck className="h-5 w-5 text-emerald-400" /> Your on-chain allocation</h2>
          {buyer ? <div className="mt-5 space-y-3 text-xs">
            <Metric label="ETH contributed" value={`${buyer.ethContributed} ETH`} />
            <Metric label="ABCD purchased" value={`${buyer.tokensPurchased} ABCD`} />
            <Metric label="Claim status" value={buyer.claimed ? 'Claimed' : presale?.status === 'Finalized' ? 'Claim available' : 'Available after finalization'} />
            {presale?.whitelistRequired && <Metric label="Whitelist" value={buyer.isWhitelisted ? 'Approved' : 'Not approved'} />}
            <p className="pt-2 text-slate-400"><Clock className="mr-1 inline h-3.5 w-3.5" /> Purchases create an allocation. The contract transfers ABCD only through <code>claimTokens()</code> after finalization.</p>
            {presale?.status === 'Finalized' && !buyer.claimed && parseEther(buyer.tokensPurchased) > 0n && (
              <button type="button" onClick={handleClaim} disabled={isPending || !isConnected || !isCorrectNetwork} className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">
                {status === 'awaiting-wallet' ? 'Confirm Claim in Wallet…' : status === 'confirming' ? 'Confirming Claim…' : 'Claim ABCD'}
              </button>
            )}
          </div> : <p className="mt-5 text-sm text-slate-400">{address && !hasCurrentBuyerRead ? 'Reading this wallet’s on-chain Presale allocation…' : 'Connect a wallet to read its Presale allocation.'}</p>}
        </section>
      </div>
    </div>
  );
};

export default PresaleICO;
