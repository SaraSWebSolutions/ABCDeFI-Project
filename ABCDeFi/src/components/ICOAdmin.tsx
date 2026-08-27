import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, ShieldCheck, Wallet } from 'lucide-react';
import { useWallet } from '../Context/WalletContext';
import {
  cancelFailedSale,
  cancelPresale,
  finalizePresale,
  getAdminPresaleData,
  pausePresale,
  presaleAdminErrorMessage,
  startPresale,
  unpausePresale,
  withdrawPresaleProceeds,
  type AdminPresaleData,
  type PresaleAdminAction,
  type PresaleAdminTransactionResult,
} from '../Services/presaleAdmin';

type TransactionStatus = 'idle' | 'preparing' | 'awaiting-wallet' | 'confirming' | 'success' | 'error';

const formatDate = (timestamp: bigint) =>
  timestamp === 0n ? 'Not scheduled' : new Date(Number(timestamp) * 1000).toLocaleString();

const shortAddress = (address: string) => `${address.slice(0, 8)}…${address.slice(-6)}`;
const sameAddress = (left: string | null | undefined, right: string | null | undefined) =>
  Boolean(left && right && left.toLowerCase() === right.toLowerCase());
const sameWalletIdentity = (left: string | null | undefined, right: string | null | undefined) =>
  (!left && !right) || sameAddress(left, right);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 break-all font-mono text-xs text-slate-100">{value}</div>
  </div>
);

interface ActionButtonProps {
  action: PresaleAdminAction;
  label: string;
  disabled: boolean;
  disabledReason: string;
  pending: boolean;
  onClick: (action: PresaleAdminAction) => void;
  tone?: 'amber' | 'emerald' | 'rose' | 'slate';
}

const ActionButton: React.FC<ActionButtonProps> = ({ action, label, disabled, disabledReason, pending, onClick, tone = 'slate' }) => {
  const colors = {
    amber: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
    emerald: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400',
    rose: 'bg-rose-600 text-white hover:bg-rose-500',
    slate: 'bg-slate-700 text-white hover:bg-slate-600',
  };
  return (
    <button
      type="button"
      title={disabled ? disabledReason : label}
      disabled={disabled || pending}
      onClick={() => onClick(action)}
      className={`rounded-xl px-4 py-3 text-xs font-black uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${colors[tone]}`}
    >
      {pending ? 'Processing…' : label}
    </button>
  );
};

/**
 * Active AdminPortalEngine ICO Admin route. This component intentionally uses
 * only the canonical Presale contract service; it has no API/mock ICO state.
 */
export const ICOAdmin: React.FC = () => {
  const { address, chainId, isConnected, isConnecting, isCorrectNetwork, networkName, connectWallet, switchWalletAccount, switchChain, refreshBalances } = useWallet();
  const [presale, setPresale] = useState<AdminPresaleData | null>(null);
  // A Presale read contains account-specific role data. Keep the account and
  // chain that produced it so a previous account can never authorize the
  // newly selected MetaMask account while a refresh is in flight.
  const [presaleReadAddress, setPresaleReadAddress] = useState<string | null>(null);
  const [presaleReadChainId, setPresaleReadChainId] = useState<bigint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState('3600');
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [message, setMessage] = useState('');
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [eventNames, setEventNames] = useState<string[]>([]);
  const currentWalletRef = useRef({ address, chainId });
  const presaleReadSequence = useRef(0);

  // Keep the latest render identity accessible to in-flight RPC reads.
  currentWalletRef.current = { address, chainId };

  const loadPresale = useCallback(async () => {
    const sequence = ++presaleReadSequence.current;
    const requestedAddress = address;
    const requestedChainId = chainId;
    setIsLoading(true);
    try {
      const data = await getAdminPresaleData(requestedAddress ?? undefined);
      const current = currentWalletRef.current;
      if (
        sequence !== presaleReadSequence.current
        || !sameWalletIdentity(current.address, requestedAddress)
        || current.chainId !== requestedChainId
      ) return;
      setPresale(data);
      setPresaleReadAddress(requestedAddress);
      setPresaleReadChainId(requestedChainId);
    } catch (error) {
      const current = currentWalletRef.current;
      if (
        sequence !== presaleReadSequence.current
        || !sameWalletIdentity(current.address, requestedAddress)
        || current.chainId !== requestedChainId
      ) return;
      console.error('Failed to read canonical Presale admin state:', error);
      setPresale(null);
      setPresaleReadAddress(null);
      setPresaleReadChainId(null);
      setStatus('error');
      setMessage(presaleAdminErrorMessage(error));
    } finally {
      if (sequence === presaleReadSequence.current) setIsLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    void loadPresale();
  }, [chainId, loadPresale]);

  const isBusy = status === 'preparing' || status === 'awaiting-wallet' || status === 'confirming';
  const hasCurrentPresaleRead = Boolean(
    presale
    && presaleReadChainId === chainId
    && sameAddress(presaleReadAddress, address),
  );
  const hasPresaleAdminRole = hasCurrentPresaleRead && Boolean(presale?.roles.presaleAdmin);
  const hasPauserRole = hasCurrentPresaleRead && Boolean(presale?.roles.pauser);
  const readyForWrites = isConnected && Boolean(address) && isCorrectNetwork && hasCurrentPresaleRead;
  const authorizationMessage = !isConnected || !address
    ? 'Connect the authorized MetaMask wallet to administer the Presale.'
    : !isCorrectNetwork
      ? 'Wrong network. Please switch MetaMask to Hardhat Local (31337).'
      : !hasCurrentPresaleRead
        ? 'Checking the connected wallet authorization on the canonical Presale contract…'
      : presale && !hasPresaleAdminRole
        ? `Admin wallet required. ${address} does not have PRESALE_ADMIN_ROLE on the canonical Presale contract.`
        : '';

  const actionState = useMemo(() => {
    const unavailable = 'Live Presale state is unavailable.';
    if (!presale || !hasCurrentPresaleRead) {
      return {
        start: [true, hasCurrentPresaleRead ? unavailable : 'Checking the current MetaMask account authorization…'],
        pause: [true, hasCurrentPresaleRead ? unavailable : 'Checking the current MetaMask account authorization…'],
        unpause: [true, hasCurrentPresaleRead ? unavailable : 'Checking the current MetaMask account authorization…'],
        cancel: [true, hasCurrentPresaleRead ? unavailable : 'Checking the current MetaMask account authorization…'],
        cancelFailed: [true, hasCurrentPresaleRead ? unavailable : 'Checking the current MetaMask account authorization…'],
        finalize: [true, hasCurrentPresaleRead ? unavailable : 'Checking the current MetaMask account authorization…'],
        withdraw: [true, hasCurrentPresaleRead ? unavailable : 'Checking the current MetaMask account authorization…'],
      } as Record<PresaleAdminAction, [boolean, string]>;
    }
    const writeBlocked = readyForWrites ? '' : authorizationMessage;
    return {
      start: [Boolean(writeBlocked) || !hasPresaleAdminRole || presale.status !== 'Pending', writeBlocked || (!hasPresaleAdminRole ? 'PRESALE_ADMIN_ROLE is required.' : 'Presale is not pending.')],
      pause: [Boolean(writeBlocked) || !hasPauserRole || presale.status !== 'Active' || presale.isPaused, writeBlocked || (!hasPauserRole ? 'PAUSER_ROLE is required.' : presale.isPaused ? 'Presale is already paused.' : 'Presale is not active.')],
      unpause: [Boolean(writeBlocked) || !hasPauserRole || !presale.isPaused, writeBlocked || (!hasPauserRole ? 'PAUSER_ROLE is required.' : 'Presale is not paused.')],
      cancel: [Boolean(writeBlocked) || !hasPresaleAdminRole || presale.isFinalized || presale.isCancelled, writeBlocked || (!hasPresaleAdminRole ? 'PRESALE_ADMIN_ROLE is required.' : presale.isFinalized ? 'Presale has already been finalized.' : 'Presale has already been cancelled.')],
      // This is permissionless in Solidity, but this Admin-only surface keeps
      // all write actions unavailable to a normal connected user wallet.
      cancelFailed: [Boolean(writeBlocked) || !hasPresaleAdminRole || presale.status !== 'Ended' || presale.totalEthRaisedRaw >= presale.softCapRaw, writeBlocked || (!hasPresaleAdminRole ? 'PRESALE_ADMIN_ROLE is required in the Admin Dashboard.' : presale.status !== 'Ended' ? 'Presale has not ended.' : 'The soft cap has been met.')],
      finalize: [Boolean(writeBlocked) || !hasPresaleAdminRole || presale.status !== 'Ended' || presale.isCancelled || presale.totalEthRaisedRaw < presale.softCapRaw, writeBlocked || (!hasPresaleAdminRole ? 'PRESALE_ADMIN_ROLE is required.' : presale.isCancelled ? 'Cancelled Presales cannot be finalized.' : presale.status !== 'Ended' ? 'Presale has not ended.' : 'The soft cap has not been met.')],
      withdraw: [Boolean(writeBlocked) || !hasPresaleAdminRole || presale.status !== 'Finalized' || presale.isCancelled, writeBlocked || (!hasPresaleAdminRole ? 'PRESALE_ADMIN_ROLE is required.' : 'Presale must be successfully finalized.')],
    } as Record<PresaleAdminAction, [boolean, string]>;
  }, [authorizationMessage, hasCurrentPresaleRead, hasPauserRole, hasPresaleAdminRole, presale, readyForWrites]);

  const runAction = async (action: PresaleAdminAction) => {
    if (isBusy) return;
    setTransactionHash(null);
    setEventNames([]);
    if (!isConnected || !address) {
      setStatus('error');
      setMessage('Connect the authorized MetaMask wallet to administer the Presale.');
      return;
    }
    if (!isCorrectNetwork) {
      setStatus('error');
      setMessage('Please switch MetaMask to Hardhat Local (31337).');
      return;
    }

    let duration: number | null = null;
    if (action === 'start') {
      duration = Number(durationSeconds);
      if (!Number.isSafeInteger(duration) || duration <= 0) {
        setStatus('error');
        setMessage('Enter a positive whole-number sale duration in seconds.');
        return;
      }
    }

    try {
      setStatus('preparing');
      setMessage('Preparing the live Presale transaction…');
      const submitted = (hash: string) => {
        setTransactionHash(hash);
        setStatus('confirming');
        setMessage('Transaction submitted. Waiting for on-chain confirmation…');
      };
      setStatus('awaiting-wallet');
      setMessage('Waiting for MetaMask confirmation…');
      let result: PresaleAdminTransactionResult;
      switch (action) {
        case 'start': result = await startPresale(duration as number, submitted); break;
        case 'pause': result = await pausePresale(submitted); break;
        case 'unpause': result = await unpausePresale(submitted); break;
        case 'cancel': result = await cancelPresale(submitted); break;
        case 'cancelFailed': result = await cancelFailedSale(submitted); break;
        case 'finalize': result = await finalizePresale(submitted); break;
        case 'withdraw': result = await withdrawPresaleProceeds(submitted); break;
      }
      setTransactionHash(result.transactionHash);
      setEventNames(result.eventNames);
      const current = currentWalletRef.current;
      if (!sameAddress(current.address, address) || current.chainId !== chainId) {
        setStatus('error');
        setMessage('MetaMask account or network changed before confirmation. The transaction result is not applied to this wallet; refreshing on-chain state.');
        await loadPresale();
        return;
      }
      setPresale(result.state);
      setPresaleReadAddress(address);
      setPresaleReadChainId(chainId);
      setStatus('success');
      setMessage(`Confirmed in block ${result.blockNumber}. On-chain Presale state refreshed.`);
      await Promise.all([loadPresale(), refreshBalances()]);
    } catch (error) {
      console.error(`Presale admin ${action} failed:`, error);
      setStatus('error');
      setMessage(presaleAdminErrorMessage(error));
    }
  };

  const connectAdminWallet = async () => {
    setMessage('');
    try {
      await connectWallet('metamask');
    } catch (error) {
      setStatus('error');
      setMessage(presaleAdminErrorMessage(error));
    }
  };

  const switchToHardhat = async () => {
    setMessage('');
    try {
      // Network switching is a separate, explicit user action.
      await switchChain('Hardhat Local');
    } catch (error) {
      setStatus('error');
      setMessage(presaleAdminErrorMessage(error));
    }
  };

  const selectAdminWallet = async () => {
    setMessage('');
    try {
      await switchWalletAccount();
    } catch (error) {
      setStatus('error');
      setMessage(presaleAdminErrorMessage(error));
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-300"><ShieldCheck className="h-4 w-4" /> Real on-chain Presale control</div>
            <h3 className="mt-1 text-xl font-black text-white">ICO Admin</h3>
            <p className="mt-2 max-w-2xl text-xs text-slate-400">This panel reads and writes only the canonical Presale contract configured by <code>deployments.json</code>. It does not use ICO export/import APIs or mock state.</p>
          </div>
          <button type="button" onClick={() => void loadPresale()} disabled={isLoading || isBusy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-xs font-bold text-slate-200 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh on-chain state
          </button>
        </div>

        <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          <Metric label="Connected wallet" value={address ? shortAddress(address) : 'Not connected'} />
          <Metric label="Network" value={isConnected ? `${networkName}${isCorrectNetwork ? ' (31337)' : ''}` : 'Not connected'} />
          <Metric label="Presale contract" value={presale ? shortAddress(presale.contractAddress) : 'Unavailable'} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!isConnected && <button type="button" onClick={() => void connectAdminWallet()} disabled={isConnecting} className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"><Wallet className="mr-1 inline h-4 w-4" />{isConnecting ? 'Connecting…' : 'Connect Admin Wallet'}</button>}
          {isConnected && !isCorrectNetwork && <button type="button" onClick={() => void switchToHardhat()} disabled={isConnecting} className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-200 disabled:cursor-not-allowed disabled:opacity-60">Switch to Hardhat Local</button>}
          {isConnected && isCorrectNetwork && presale && hasCurrentPresaleRead && !hasPresaleAdminRole && <button type="button" onClick={() => void selectAdminWallet()} disabled={isConnecting} className="rounded-xl border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-200 disabled:cursor-not-allowed disabled:opacity-60">{isConnecting ? 'Switching…' : 'Switch MetaMask Account'}</button>}
          {isConnected && isCorrectNetwork && hasPresaleAdminRole && <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-200">Admin Wallet Connected</span>}
        </div>
        {authorizationMessage && <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100"><AlertTriangle className="mr-2 inline h-4 w-4" />{authorizationMessage}</div>}
      </section>

      {isLoading ? <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Reading canonical Presale contract…</section> : presale ? <>
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <h4 className="text-sm font-black uppercase tracking-wide text-white">Live Presale state</h4>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
            <Metric label="Status" value={presale.status} />
            <Metric label="Rate" value={`${presale.rate} ABCD / ETH`} />
            <Metric label="Soft cap" value={`${presale.softCap} ETH`} />
            <Metric label="Hard cap" value={`${presale.hardCap} ETH`} />
            <Metric label="Minimum buy" value={`${presale.minBuy} ETH`} />
            <Metric label="Maximum wallet" value={`${presale.maxBuy} ETH`} />
            <Metric label="ETH raised" value={`${presale.totalEthRaised} ETH`} />
            <Metric label="ABCD sold" value={`${presale.totalTokensSold} ABCD`} />
            <Metric label="ABCD reserve" value={`${presale.tokenReserve} ABCD`} />
            <Metric label="Start time" value={formatDate(presale.startTime)} />
            <Metric label="End time" value={formatDate(presale.endTime)} />
            <Metric label="Paused / final / cancelled" value={`${presale.isPaused ? 'Yes' : 'No'} / ${presale.isFinalized ? 'Yes' : 'No'} / ${presale.isCancelled ? 'Yes' : 'No'}`} />
            <Metric label="Token address" value={shortAddress(presale.tokenAddress)} />
            <Metric label="Treasury address" value={shortAddress(presale.treasuryAddress)} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-amber-300" /><h4 className="text-sm font-black uppercase tracking-wide text-white">On-chain roles for connected wallet</h4></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="DEFAULT_ADMIN_ROLE" value={hasCurrentPresaleRead ? (presale.roles.defaultAdmin ? 'Granted' : 'Not granted') : 'Checking…'} />
            <Metric label="PRESALE_ADMIN_ROLE" value={hasCurrentPresaleRead ? (presale.roles.presaleAdmin ? 'Granted' : 'Not granted') : 'Checking…'} />
            <Metric label="PAUSER_ROLE" value={hasCurrentPresaleRead ? (presale.roles.pauser ? 'Granted' : 'Not granted') : 'Checking…'} />
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h4 className="text-sm font-black uppercase tracking-wide text-white">Administrative actions</h4><p className="mt-1 text-xs text-slate-400">Each action rechecks the live chain, connected wallet, and required role before MetaMask is asked to sign.</p></div>
            {presale.status === 'Pending' && <label className="text-xs text-slate-300">Sale duration (seconds)<input value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} inputMode="numeric" disabled={isBusy} className="mt-1 block w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-white disabled:opacity-50" /></label>}
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionButton action="start" label="Start Presale" disabled={actionState.start[0]} disabledReason={actionState.start[1]} pending={isBusy} onClick={(action) => void runAction(action)} tone="amber" />
            <ActionButton action="pause" label="Pause" disabled={actionState.pause[0]} disabledReason={actionState.pause[1]} pending={isBusy} onClick={(action) => void runAction(action)} tone="rose" />
            <ActionButton action="unpause" label="Unpause" disabled={actionState.unpause[0]} disabledReason={actionState.unpause[1]} pending={isBusy} onClick={(action) => void runAction(action)} tone="emerald" />
            <ActionButton action="cancel" label="Cancel sale" disabled={actionState.cancel[0]} disabledReason={actionState.cancel[1]} pending={isBusy} onClick={(action) => void runAction(action)} tone="rose" />
            <ActionButton action="cancelFailed" label="Cancel failed sale" disabled={actionState.cancelFailed[0]} disabledReason={actionState.cancelFailed[1]} pending={isBusy} onClick={(action) => void runAction(action)} tone="rose" />
            <ActionButton action="finalize" label="Finalize sale" disabled={actionState.finalize[0]} disabledReason={actionState.finalize[1]} pending={isBusy} onClick={(action) => void runAction(action)} tone="emerald" />
            <ActionButton action="withdraw" label="Withdraw proceeds" disabled={actionState.withdraw[0]} disabledReason={actionState.withdraw[1]} pending={isBusy} onClick={(action) => void runAction(action)} tone="slate" />
          </div>
          <p className="mt-4 text-[11px] text-slate-500"><Clock className="mr-1 inline h-3.5 w-3.5" /> <code>cancelFailedSale()</code> is permissionless in the deployed contract, but this Admin surface requires <code>PRESALE_ADMIN_ROLE</code> before exposing any write action.</p>
        </section>
      </> : <section className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">The live Presale state is unavailable. No admin action can be sent until the canonical contract is readable.</section>}

      {status !== 'idle' && <section className={`rounded-2xl border p-4 text-xs ${status === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : status === 'error' ? 'border-rose-500/30 bg-rose-500/10 text-rose-100' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}>
        <div className="flex gap-2">{isBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : status === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<span>{message}</span></div>
        {transactionHash && <div className="mt-2 break-all font-mono">Transaction hash: {transactionHash}</div>}
        {eventNames.length > 0 && <div className="mt-2">Contract events: {eventNames.join(', ')}</div>}
      </section>}
    </div>
  );
};

export default ICOAdmin;
