import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther, parseEther } from 'ethers';
import { useWallet } from '../Context/WalletContext';
import { getLendingV2Contracts, getLendingV2DeploymentBlock, getLendingV2DeploymentVersion } from '../Config/contracts';
import {
  addV2LoanCollateral, borrowV2, createV2Request, depositV2Collateral, fundV2Request,
  getV2CanonicalP2PLoan, getV2LatestDirectLoanForWallet, getV2LatestPendingDepositForWallet, getV2Loan, getV2OpenP2PRequests, getV2P2PRequestHistory, getV2PendingDeposit, getV2ProtocolState, getV2ReserveState,
  getV2IndexerStatus, getV2P2PRequestCapacity, getV2Request, getV2WalletHistory, lendingV2ErrorMessage,
  executeV2OverdueEmi, liquidateV2, payV2DirectInstallment, payV2Emi, payV2OutstandingEmi, repayAllV2, repayV2, stateLabel,
  syncV2LoanRisk, withdrawV2Collateral,
  type CompletionCertificateMetadata, type V2CanonicalP2PLoan, type V2OpenP2PRequest, type V2P2PRequestHistory, type V2PendingDeposit, type V2ProgressListener, type V2Read, type V2Request, type V2ReserveEvent, type V2Tx,
} from '../Services/lendingV2';
import { borrowBlocker, directStage, loanActions, positiveAmount, sameAmount, sameWallet, validId, validTerm, withinCapacity } from '../Utils/lendingV2Flow';
import { synchronizeLendingV2HistoryAfterReceipt } from '../Utils/lendingV2HistorySync';
import { prepareLoanCompletionMetadata, type PublishedCompletionMetadata } from '../Services/lendingV2Metadata';
import { bindLendingReferrer, claimLendingAccruedReward, createLendingReferralCode, getLendingReferralRecord, getLendingReferralSnapshot, type LendingReferralSnapshot, type LendingReferralTransaction } from '../Services/lendingReferralV2';
import type { LendingNavigationContext, LendingProductContext, P2PLendingSection } from '../Utils/dashboardMode';
import { Card, Empty, Field, Term, Metric, Metrics, ReadError, V2TransactionStatus, primary, secondary, percent, timestamp, type TransactionState } from './lendingV2/LendingV2Presentation';

// Each response belongs to its exact wallet/selection key. A slow old request
// must never replace a new account's preview or re-enable a stale action.
function useRead<T>(key: string | null, read: () => Promise<T>) {
  const reader = useRef(read); reader.current = read;
  const currentKey = useRef(key); currentKey.current = key;
  const serial = useRef(0);
  const [snapshot, setSnapshot] = useState<{ key: string | null; data: T | null; error: string | null; loading: boolean }>({ key: null, data: null, error: null, loading: false });
  const reload = useCallback(async (): Promise<T | null> => {
    const requestKey = key; const request = ++serial.current;
    if (!requestKey) return null;
    setSnapshot({ key: requestKey, data: null, error: null, loading: true });
    try {
      const data = await reader.current();
      if (request === serial.current && currentKey.current === requestKey) setSnapshot({ key: requestKey, data, error: null, loading: false });
      return data;
    } catch (error) {
      if (request === serial.current && currentKey.current === requestKey) setSnapshot({ key: requestKey, data: null, error: lendingV2ErrorMessage(error), loading: false });
      throw error;
    }
  }, [key]);
  useEffect(() => { if (key) void reload().catch(() => {}); return () => { ++serial.current; }; }, [key, reload]);
  const visible = snapshot.key === key ? snapshot : { data: null, error: null, loading: !!key };
  return { ...visible, reload };
}

type Scope = LendingProductContext;
type P2PView = 'requests' | 'mine' | 'status';
type Selection = { wallet: string; depositId: string; loanId: string; requestId: string; p2pLoanId: string };
const emptySelection = (wallet: string): Selection => ({ wallet, depositId: '', loanId: '', requestId: '', p2pLoanId: '' });

export interface LendingV2Props {
  /** The one canonical shell-to-workspace navigation contract. */
  context?: LendingNavigationContext;
  onContextChange?: (context: LendingNavigationContext) => void;
}

export const LendingV2: React.FC<LendingV2Props> = ({ context, onContextChange }) => {
  const { address, isConnected, isCorrectNetwork, refreshBalances } = useWallet();
  const contracts = getLendingV2Contracts();
  const wallet = isConnected && address ? address.toLowerCase() : '';
  const walletRef = useRef(wallet); walletRef.current = wallet;
  const [selection, setSelection] = useState<Selection>(() => emptySelection(wallet));
  const selected = selection.wallet === wallet ? selection : emptySelection(wallet);
  const { depositId, loanId, requestId, p2pLoanId } = selected;
  const select = (field: keyof Omit<Selection, 'wallet'>, value: string) => setSelection(previous => ({ ...(previous.wallet === wallet ? previous : emptySelection(wallet)), [field]: value }));
  const [uncontrolledTab, setUncontrolledTab] = useState<Scope>('direct');
  const [uncontrolledP2PView, setUncontrolledP2PView] = useState<P2PView>('requests');
  const tab = context?.product ?? uncontrolledTab;
  const p2pView = context?.product === 'p2p'
    ? context.section as P2PView
    : uncontrolledP2PView;
  const setTab = (next: Scope) => {
    if (context) {
      onContextChange?.({ product: next, section: next === 'p2p' ? 'requests' : 'overview' });
      return;
    }
    setUncontrolledTab(next);
  };
  const setP2PView = (next: P2PView) => {
    if (context?.product === 'p2p') {
      onContextChange?.({ product: 'p2p', section: next as P2PLendingSection });
      return;
    }
    setUncontrolledP2PView(next);
  };
  const [collateral, setCollateral] = useState('');
  const [principal, setPrincipal] = useState('');
  const [term, setTerm] = useState('30');
  const [repayment, setRepayment] = useState('');
  const [topUp, setTopUp] = useState('');
  const [publishedCompletionMetadata, setPublishedCompletionMetadata] = useState<PublishedCompletionMetadata | null>(null);
  const [completionBusy, setCompletionBusy] = useState(false);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [p2pPrincipal, setP2pPrincipal] = useState(''); const [p2pCollateral, setP2pCollateral] = useState('');
  const [p2pTerm, setP2pTerm] = useState('30');
  const [p2pPayment, setP2pPayment] = useState('');
  const [p2pTopUp, setP2pTopUp] = useState('');
  const [transaction, setTransaction] = useState<TransactionState | null>(null);
  const [operation, setOperation] = useState<{ scope: Scope; name: string } | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const historySynchronization = useRef(0);
  const [depositReceipt, setDepositReceipt] = useState<V2Tx | null>(null);
  const [discovery, setDiscovery] = useState<{ wallet: string; loading: boolean; error: string | null }>({ wallet: '', loading: false, error: null });
  const [discoveryAttempt, setDiscoveryAttempt] = useState(0);
  const [loanDiscovery, setLoanDiscovery] = useState<{ wallet: string; loading: boolean; error: string | null }>({ wallet: '', loading: false, error: null });
  const [loanDiscoveryAttempt, setLoanDiscoveryAttempt] = useState(0);
  const protocol = useRead(contracts ? 'protocol' : null, getV2ProtocolState);
  const reserveRead = useRead(contracts ? 'reserve' : null, getV2ReserveState);
  const pending = useRead(contracts && wallet && validId(depositId) ? `${wallet}:deposit:${depositId}` : null, () => getV2PendingDeposit(depositId));
  const directLoan = useRead(contracts && wallet && validId(loanId) ? `${wallet}:direct:${loanId}` : null, () => getV2Loan(loanId));
  const peerLoan = useRead(contracts && wallet && validId(p2pLoanId) ? `${wallet}:p2p:${p2pLoanId}` : null, () => getV2Loan(p2pLoanId));
  // This is intentionally separate from the direct contract read above: a
  // receipt or optimistic UI state must never be shown as reconciled recovery
  // evidence before the canonical indexer/API confirms it.
  const peerRecovery = useRead(contracts && wallet && validId(p2pLoanId) ? `${wallet}:p2p-recovery:${p2pLoanId}` : null, () => getV2CanonicalP2PLoan(p2pLoanId));
  const request = useRead(contracts && wallet && validId(requestId) ? `${wallet}:request:${requestId}` : null, () => getV2Request(requestId));
  const history = useRead(contracts && wallet ? `${wallet}:history` : null, () => getV2WalletHistory(wallet));
  // Discovery is intentionally shared: unlike My P2P, it is not derived from
  // the connected wallet and it never grants ownership or write authority.
  const openP2PRequests = useRead(contracts ? 'p2p-open-requests' : null, getV2OpenP2PRequests);
  const p2pCapacity = useRead(contracts && wallet && positiveAmount(p2pCollateral) ? `${wallet}:p2p-capacity:${p2pCollateral}` : null, () => getV2P2PRequestCapacity(p2pCollateral));
  const deposit = pending.data;
  const loan = directLoan.data?.isDirect ? directLoan.data : null;
  const p2pLoan = peerLoan.data && !peerLoan.data.isDirect ? peerLoan.data : null;
  const busy = operation !== null;
  const canWrite = !!wallet && isCorrectNetwork && !busy;
  const actions = loanActions(loan, wallet);
  const peerActions = loanActions(p2pLoan, wallet);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; historySynchronization.current += 1; };
  }, []);

  useEffect(() => {
    historySynchronization.current += 1;
    setSelection(emptySelection(wallet)); setDepositReceipt(null); setTransaction(null); setOperation(null);
    setPrincipal(''); setRepayment(''); setTopUp('');
    setPublishedCompletionMetadata(null); setCompletionMessage(null);
    setP2pPrincipal(''); setP2pCollateral(''); setP2pTerm('30');
    setP2pTopUp('');
  }, [wallet]);

  // Restore only an actual current canonical pool event for this wallet.
  useEffect(() => {
    if (!contracts || !wallet || validId(depositId)) return;
    let cancelled = false;
    setDiscovery({ wallet, loading: true, error: null });
    void getV2LatestPendingDepositForWallet(wallet).then(latest => {
      if (cancelled || walletRef.current !== wallet || !latest) return;
      setSelection(previous => {
        const value = previous.wallet === wallet ? previous : emptySelection(wallet);
        return validId(value.depositId) ? value : { ...value, depositId: latest.depositId };
      });
    }).catch(error => { if (!cancelled) setDiscovery({ wallet, loading: false, error: lendingV2ErrorMessage(error) }); })
      .finally(() => { if (!cancelled) setDiscovery(previous => ({ ...previous, loading: false })); });
    return () => { cancelled = true; };
  }, [wallet, depositId, !!contracts, discoveryAttempt]);

  // A freshly mined direct borrow is immediately readable from the canonical
  // pool and manager, even before the confirmed event indexer reaches its tip.
  useEffect(() => {
    if (!contracts || !wallet || validId(loanId)) return;
    let cancelled = false;
    setLoanDiscovery({ wallet, loading: true, error: null });
    void getV2LatestDirectLoanForWallet(wallet).then(latest => {
      if (cancelled || walletRef.current !== wallet || !latest) return;
      setSelection(previous => {
        const value = previous.wallet === wallet ? previous : emptySelection(wallet);
        return validId(value.loanId) ? value : { ...value, loanId: latest };
      });
    }).catch(error => { if (!cancelled) setLoanDiscovery({ wallet, loading: false, error: lendingV2ErrorMessage(error) }); })
      .finally(() => { if (!cancelled) setLoanDiscovery(previous => ({ ...previous, loading: false })); });
    return () => { cancelled = true; };
  }, [wallet, loanId, !!contracts, loanDiscoveryAttempt]);

  useEffect(() => {
    const funded = request.data;
    if (funded && validId(funded.loanId)) select('p2pLoanId', funded.loanId);
  }, [request.data]);

  // Completion records are signed and published for exactly one borrower loan.
  // Never allow a record prepared for a previous selection to be reused for a
  // different direct/P2P loan after a dashboard selection change.
  useEffect(() => {
    setPublishedCompletionMetadata(null); setCompletionMessage(null);
  }, [tab, loanId, p2pLoanId]);

  // Legacy lending aliases now resolve to one workspace plus an explicit
  // canonical context. Scroll only after the controlled context is rendered.
  useEffect(() => {
    if (context?.product !== 'direct' || context.section === 'overview') return;
    const targetId: Record<string, string> = {
      loans: 'v2-loans', repayment: 'v2-repayment', collateral: 'v2-collateral', risk: 'v2-collateral',
    };
    const target = targetId[context.section];
    if (!target) return;
    const timeout = window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
    return () => window.clearTimeout(timeout);
  }, [context?.product, context?.section]);

  const refresh = async () => {
    await Promise.allSettled([protocol.reload(), pending.reload(), directLoan.reload(), peerLoan.reload(), request.reload(), history.reload(), openP2PRequests.reload(), refreshBalances()]);
  };
  const execute = async (scope: Scope, name: string, send: (progress: V2ProgressListener) => Promise<V2Tx>) => {
    if (inFlight.current) return;
    if (!wallet || !isCorrectNetwork) {
      setTransaction({ action: name, error: !wallet ? 'Connect MetaMask first.' : 'Switch MetaMask to Hardhat Local (31337).' }); return;
    }
    const submittingWallet = wallet;
    const synchronizationId = ++historySynchronization.current;
    const isCurrentHistorySynchronization = () => mounted.current && historySynchronization.current === synchronizationId && walletRef.current === submittingWallet;
    inFlight.current = true; setOperation({ scope, name }); setTransaction({ action: name });
    let tx: V2Tx;
    try {
      tx = await send(progress => { if (walletRef.current === submittingWallet) setTransaction({ action: name, progress }); });
    } catch (error) {
      if (isCurrentHistorySynchronization()) setTransaction(previous => ({ ...previous, action: name, error: lendingV2ErrorMessage(error) }));
      inFlight.current = false;
      if (isCurrentHistorySynchronization()) setOperation(null);
      return;
    }
    // Receipt success is final even if subsequent RPC/indexer refresh fails.
    if (isCurrentHistorySynchronization()) {
      setTransaction({ action: name, result: tx });
      setSelection(previous => {
        const value = previous.wallet === submittingWallet ? previous : emptySelection(submittingWallet);
        if (scope === 'direct') return { ...value, depositId: name === 'Borrow' ? '' : tx.depositId || value.depositId, loanId: tx.loanId || value.loanId };
        return { ...value, requestId: tx.requestId || value.requestId, p2pLoanId: tx.loanId || value.p2pLoanId };
      });
      if (name === 'Collateral deposit') setDepositReceipt(tx);
      // The confirmed-event projection may lag the wallet receipt. Preserve
      // direct contract reads, but wait for the matching canonical checkpoint
      // before replacing wallet history with an indexed snapshot.
      const historyAfterCheckpoint = synchronizeLendingV2HistoryAfterReceipt({
        receiptBlock: tx.blockNumber,
        expectedDeploymentVersion: getLendingV2DeploymentVersion(),
        readCheckpoint: getV2IndexerStatus,
        reloadHistory: history.reload,
        isCurrent: isCurrentHistorySynchronization,
      });
      // Verify the affected objects, including the vault after withdrawal.
      const reads: Promise<unknown>[] = [refreshBalances(), protocol.reload(), historyAfterCheckpoint];
      if (tx.depositId) reads.push(getV2PendingDeposit(tx.depositId));
      if (tx.loanId) reads.push(getV2Loan(tx.loanId));
      if (scope === 'direct' && validId(loanId)) reads.push(directLoan.reload());
      if (scope === 'direct' && validId(depositId)) reads.push(pending.reload());
      if (scope === 'p2p' && validId(requestId)) reads.push(request.reload());
      if (scope === 'p2p' && validId(p2pLoanId)) reads.push(peerLoan.reload());
      const results = await Promise.allSettled(reads);
      const failed = results.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed && isCurrentHistorySynchronization()) setTransaction({ action: name, result: tx, refreshWarning: lendingV2ErrorMessage(failed.reason) });
    }
    inFlight.current = false;
    if (isCurrentHistorySynchronization()) setOperation(null);
  };
  const readBorrowCapacity = () => { void pending.reload().catch(() => {}); };
  const p2pWithinCapacity = Boolean(p2pCapacity.data && withinCapacity(p2pPrincipal, p2pCapacity.data.maxPrincipal));
  const p2pRemainingCapacity = (() => {
    if (!p2pCapacity.data || !positiveAmount(p2pPrincipal) || !p2pWithinCapacity) return 'Unavailable';
    try { return formatEther(parseEther(p2pCapacity.data.maxPrincipal) - parseEther(p2pPrincipal)); }
    catch { return 'Unavailable'; }
  })();
  const blocker = borrowBlocker({ deposit, depositId, address: wallet, connected: isConnected, correctNetwork: isCorrectNetwork, loading: pending.loading, error: pending.error, principal, term });
  const stage = directStage({ loan, deposit, capacityLoading: pending.loading, operation: operation?.scope === 'direct' ? operation.name : null, depositConfirmed: !!depositReceipt });
  const stageText = stage.replace(/_/g, ' ').toLowerCase();
  const p = protocol.data;
  const knownLoans = history.data?.loans || [];
  const directLoanClosed = loan?.state === 5;
  const p2pLoanClosed = p2pLoan?.state === 5;
  const requestReady = request.data && request.data.requestId === requestId;
  const currentRequest = requestReady ? request.data : null;
  const selectP2PRequest = (nextRequestId: string) => {
    select('requestId', nextRequestId); select('p2pLoanId', ''); setP2PView('status');
  };
  const selectP2PLoan = (nextLoanId: string) => {
    select('p2pLoanId', nextLoanId); setP2PView('status');
  };
  const loadP2PRequest = () => {
    // Funding a peer request must start with the marketplace's current
    // canonical state.  This is deliberately a direct contract read rather
    // than an indexer lookup, because a newly mined request can still be
    // awaiting the confirmed-event checkpoint.
    if (!validId(requestId)) return;
    void request.reload().catch(() => {});
  };
  const prepareCompletionMetadata = async (selectedLoanId: string): Promise<CompletionCertificateMetadata> => {
    if (!wallet || !validId(selectedLoanId)) throw new Error('Load the borrower loan before completing settlement.');
    setCompletionBusy(true); setCompletionMessage('ABCDeFi is preparing the three platform completion records…');
    try {
      const result = await prepareLoanCompletionMetadata({ loanId: selectedLoanId, borrower: wallet });
      const metadata = {
        lender: { metadataUri: result.lender.metadataUri, metadataHash: result.lender.metadataHash },
        borrower: { metadataUri: result.borrower.metadataUri, metadataHash: result.borrower.metadataHash },
        platform: { metadataUri: result.platform.metadataUri, metadataHash: result.platform.metadataHash },
      };
      setPublishedCompletionMetadata(result);
      setCompletionMessage(`Prepared lender, borrower, and platform completion records for loan #${selectedLoanId}.`);
      return metadata;
    } catch (error) { setCompletionMessage(lendingV2ErrorMessage(error)); throw error; }
    finally { setCompletionBusy(false); }
  };

  if (!contracts) return <Card title="Lending V2 unavailable"><Empty>Not available on the current canonical deployment. No V2 transactions can be submitted.</Empty></Card>;

  return <section className="space-y-6" aria-label="Lending V2">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">ABCD Lending</p><h2 className="mt-1 text-3xl font-bold text-white">Your lending workspace</h2><p className="mt-2 text-sm text-slate-300">Deposit collateral, review your borrowing capacity, and manage your loan.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={busy} className={secondary}>Refresh balances & positions</button>
    </header>
    {!wallet && <Empty>Connect your wallet to load your positions and submit transactions.</Empty>}
    {wallet && !isCorrectNetwork && <Empty>Switch MetaMask to Hardhat Local (31337) to submit transactions.</Empty>}
    <V2TransactionStatus state={transaction} />
    <div role="tablist" aria-label="Lending workflow" className="flex gap-2 rounded-xl bg-slate-900 p-2">
      <button role="tab" aria-selected={tab === 'direct'} onClick={() => setTab('direct')} className={tab === 'direct' ? primary : secondary}>Direct Lending</button>
      <button role="tab" aria-selected={tab === 'p2p'} onClick={() => setTab('p2p')} className={tab === 'p2p' ? primary : secondary}>P2P Marketplace</button>
    </div>
    {tab === 'direct' && <section role="tabpanel" aria-label="Lending V2 direct lending flow" className="space-y-5">
      <header className="space-y-1"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">Direct Lending</p><h3 className="text-2xl font-bold text-white">Borrow against your canonical V2 collateral position.</h3></header>
      <p role="status" className="text-sm capitalize text-cyan-200">Current lending stage: {stageText}</p>
      <DirectLoanSummary loan={loan} loanId={loanId} actions={actions} canWrite={canWrite} onRepay={() => document.getElementById('v2-repayment')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} onCollateral={() => document.getElementById('v2-collateral')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      {loan && <LoanLifecycle loan={loan} />}
      <Card title="Start a Direct Loan">
        <div className="grid items-end gap-4 sm:grid-cols-2"><Field label="ETH amount" inputMode="decimal" value={collateral} onChange={setCollateral} />
          <button type="button" aria-label="Deposit collateral into LendingPoolV2" className={primary} disabled={!canWrite || !positiveAmount(collateral)} onClick={() => void execute('direct', 'Collateral deposit', progress => depositV2Collateral(collateral, progress))}>Deposit ETH collateral</button></div>
        {depositReceipt && <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4"><p className="font-bold text-emerald-200">Deposit confirmed ✓</p><Metrics><Metric label="Deposit ID" value={`#${depositReceipt.depositId}`} /><Metric label="Block" value={depositReceipt.blockNumber} /><Metric label="Collateral" value={deposit?.depositId === depositReceipt.depositId ? `${deposit.collateralETH} ETH` : 'Read deposit below'} /></Metrics><p className="break-all text-xs text-slate-300">{depositReceipt.hash}</p><button type="button" className={secondary} onClick={() => { if (depositReceipt.depositId) select('depositId', depositReceipt.depositId); document.getElementById('v2-borrow-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Continue to Borrow Preview</button></div>}
      </Card>
      <Card title="2. Preview and borrow ABCD" id="v2-borrow-preview">
        <div className="grid items-end gap-4 sm:grid-cols-2"><Field label="Pending deposit ID" inputMode="numeric" value={depositId} onChange={value => select('depositId', value)} /><button type="button" className={secondary} disabled={busy || pending.loading || !validId(depositId)} onClick={readBorrowCapacity}>{pending.loading ? 'Reading on-chain capacity…' : 'Read on-chain borrow capacity'}</button></div>
        {discovery.wallet === wallet && discovery.loading && !depositId && <p role="status" className="text-sm text-cyan-200">Finding your active collateral deposits…</p>}
        {discovery.wallet === wallet && discovery.error && <ReadError error={discovery.error} retry={() => setDiscoveryAttempt(value => value + 1)} />}
        <ReadError error={pending.error} retry={readBorrowCapacity} />
        {pending.loading && <p role="status" className="text-sm text-cyan-200">Loading authoritative borrowing capacity…</p>}
        {!deposit && !pending.loading && !pending.error && <Empty>Deposit ETH collateral to begin lending, or enter an existing deposit ID.</Empty>}
        {deposit && <div data-testid="v2-pending-deposit-preview" className="space-y-4"><p className="font-bold text-emerald-200">Pending Deposit ID: <code>{deposit.depositId}</code></p><Metrics><Metric label="Collateral" value={`${deposit.collateralETH} ETH`} /><Metric label="Oracle value" value={`$${deposit.collateralUSD}`} /><Metric label="Maximum LTV" value={percent(p?.initialLtvBps)} /><Metric label="Max borrow" value={`${deposit.maxBorrowable} ABCD`} /><Metric label="Borrower" value={deposit.borrower} /><Metric label="Active" value={deposit.active ? 'Yes' : 'No'} /></Metrics></div>}
        <V2BorrowForm deposit={deposit} principal={principal} setPrincipal={setPrincipal} term={term} setTerm={setTerm} blocker={blocker} busy={busy} apr={p?.aprBps} ltv={p?.initialLtvBps} onBorrow={() => { if (!blocker) void execute('direct', 'Borrow', progress => borrowV2(depositId, principal, Number(term), progress)); }} />
        <CompletionLifecycleNotice />
      </Card>
      <Card title="Active Loan Summary & Loan Status" id="v2-loans">
        <LoanSelector value={loanId} onChange={value => select('loanId', value)} records={knownLoans.filter(record => sameWallet((record.loan as Record<string, unknown> | undefined)?.lender as string, contracts.pool))} />
        {loanDiscovery.wallet === wallet && loanDiscovery.loading && !loanId && <p role="status">Finding your current direct loans from canonical V2 events…</p>}
        {loanDiscovery.wallet === wallet && loanDiscovery.error && <ReadError error={loanDiscovery.error} retry={() => setLoanDiscoveryAttempt(value => value + 1)} />}
        <ReadError error={directLoan.error} retry={() => void directLoan.reload().catch(() => {})} />
        {directLoan.loading && <p role="status">Reading loan state…</p>}
        {directLoan.data && !directLoan.data.isDirect && <Empty>This is a P2P loan. Open it under P2P Lending.</Empty>}
        {loan ? <LoanStatus loan={loan} loanId={loanId} wallet={wallet} /> : <Empty>No direct loan selected. A confirmed borrow creates your Loan ID automatically.</Empty>}
      </Card>
      <Card title="Repayment" id="v2-repayment">
        <p className="text-sm text-slate-300">Repayment uses the live canonical debt read. A wallet confirmation and successful on-chain receipt, not a button click, determine settlement.</p>
        {actions.repay ? <><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Current outstanding debt" value={`${loan!.outstanding} ABCD`} /><Metric label="Accrued interest" value={`${loan!.accruedInterest} ABCD`} /></Metrics>{loan!.state === 7 ? <p className="text-sm text-amber-100">Residual debt remains payable. It was recorded after the approved collateral/recovery waterfall and does not create completion certificates; collateral cannot be withdrawn while debt remains.</p> : loan!.schedule && <><Metrics><Metric label="Next Direct installment" value={`${loan!.schedule.installmentAmount} ABCD`} /><Metric label="Recovery state" value={loan!.schedule.state} /><Metric label="Amount applied" value={`${loan!.schedule.amountApplied} ABCD`} /><Metric label="Remaining scheduled due" value={`${loan!.schedule.remainingDue} ABCD`} /><Metric label="Installments paid" value={`${loan!.schedule.paidInstallments} / ${loan!.schedule.installmentCount}`} /><Metric label="Next due" value={timestamp(loan!.schedule.nextDueAt)} /></Metrics>{!loan!.schedule.completed && !loan!.schedule.due && <p role="status" className="text-sm text-amber-200">The next Direct installment is not due yet. Eligibility is read from the canonical chain block timestamp.</p>}<button className={primary} disabled={!canWrite || loan!.schedule.completed || !loan!.schedule.due || completionBusy} onClick={() => void execute('direct', 'Direct installment payment', progress => payV2DirectInstallment(loanId, prepareCompletionMetadata, progress))}>Approve ABCD & pay next installment</button></>}<Field label="Partial ABCD amount" inputMode="decimal" value={repayment} onChange={setRepayment} /><CompletionSettlementNotice busy={completionBusy} message={completionMessage} metadata={publishedCompletionMetadata} /><div className="flex flex-wrap gap-3"><button className={primary} disabled={!canWrite || !withinCapacity(repayment, loan!.outstanding) || sameAmount(repayment, loan!.outstanding)} onClick={() => void execute('direct', 'Partial repayment', progress => repayV2(loanId, repayment, progress))}>Repay partial</button><button className={secondary} disabled={!canWrite || completionBusy} onClick={() => void execute('direct', 'Full repayment', progress => repayAllV2(loanId, prepareCompletionMetadata, progress))}>{loan!.state === 7 ? 'Repay all residual debt' : 'Repay all & create certificates'}</button></div></> : <Empty>{!loan ? 'Repayment becomes available after a loan is created.' : 'Repayment is unavailable for this wallet or the current loan state.'}</Empty>}
      </Card>
      <Card title="Collateral" id="v2-collateral">
        <p className="text-sm text-slate-300">Original collateral is immutable loan provenance; current collateral is the authoritative CollateralVaultV2 balance used for risk reads.</p>
        {loan?.state === 6 && <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100"><p className="font-bold">Margin Call Active</p><p>{p ? Number(p.marginCallCureSeconds) / 3600 : 'Unavailable'}-hour cure period</p><p>Deadline: {timestamp(loan.marginCallCureEnd)}</p><p className="mt-2 text-sm">Repay to cure or add collateral to cure. Refresh and sync risk state to confirm whether the margin call is cleared.</p></div>}
        {actions.topUp ? <><Metrics><Metric label="Original collateral" value={`${loan!.originalCollateralETH} ETH`} /><Metric label="Current vault collateral" value={`${loan!.currentVaultCollateralETH} ETH`} /><Metric label="Current debt" value={`${loan!.outstanding} ABCD`} /><Metric label="Current LTV" value={percent(loan!.ltvBps)} /><Metric label="Margin-call threshold" value={percent(p?.marginCallThresholdBps)} /><Metric label="Liquidation threshold" value={percent(p?.liquidationThresholdBps)} /></Metrics><Field label="Additional ETH collateral" inputMode="decimal" value={topUp} onChange={setTopUp} /><button className={primary} disabled={!canWrite || !positiveAmount(topUp)} onClick={() => void execute('direct', 'Loan collateral top-up', progress => addV2LoanCollateral(loanId, topUp, progress))}>{loan?.state === 6 ? 'Add collateral to cure' : 'Add collateral'}</button></> : <Empty>Collateral top-ups become available for an active loan owned by this wallet.</Empty>}
        {loan && [0, 2, 6].includes(loan.state) && <button className={secondary} disabled={!canWrite} onClick={() => void execute('direct', 'Risk-state synchronization', progress => syncV2LoanRisk(loanId, progress))}>Sync risk state</button>}
      </Card>
      {(directLoanClosed || (loan?.schedule && loan.schedule.due && !loan.schedule.completed)) && <details className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5"><summary className="cursor-pointer font-semibold text-amber-100">Due-installment collateral recovery</summary><div className="mt-4">{directLoanClosed ? <ClosedLoanRecoveryNotice /> : loan?.schedule ? <><p className="text-sm text-slate-300">This recovery route is exposed only because the canonical block timestamp says the selected installment is due. The contract still validates all risk and collateral preconditions.</p><Metrics><Metric label="Recovery state" value={loan.schedule.state} /><Metric label="Exact remaining due" value={`${loan.schedule.remainingDue} ABCD`} /><Metric label="Due time" value={timestamp(loan.schedule.nextDueAt)} /></Metrics><button className={`${secondary} mt-4`} disabled={!canWrite} onClick={() => void execute('direct', 'Due-installment collateral recovery', progress => executeV2OverdueEmi(loanId, progress))}>Execute due collateral recovery</button></> : null}</div></details>}
      <Card title="5. Withdraw Collateral">
        {actions.withdraw ? <><p className="font-bold text-emerald-200">Loan repaid ✓ — collateral available</p><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Current vault collateral available" value={`${loan!.currentVaultCollateralETH} ETH`} /><Metric label="Settlement state" value={stateLabel(loan!.state)} /></Metrics><button className={primary} disabled={!canWrite} onClick={() => void execute('direct', 'Collateral withdrawal', progress => withdrawV2Collateral(loanId, progress))}>Withdraw collateral</button></> : <Empty>{loan?.state === 5 && !positiveAmount(loan.currentVaultCollateralETH) ? 'Collateral withdrawn. The loan is closed.' : loan && positiveAmount(loan.outstanding) ? 'Collateral withdrawal is locked while debt remains.' : 'Collateral can be withdrawn after the loan is fully settled.'}</Empty>}
      </Card>
      {loan?.liquidatable && <Card title="Partial liquidation required"><p className="text-sm text-amber-200">This loan has reached the canonical liquidation threshold. The protocol derives all recovery inputs from its configured sources; this UI cannot provide an amount.</p>{p?.partialLiquidationExecution === 'CONFIGURED' ? <><p className="mt-2 text-sm text-amber-100">Configured — local test-only; not production policy. A normal partial liquidation never uses Reserve coverage or creates bad debt. The contract enforces the actual route, recovery order, and target check.</p><button className={`${secondary} mt-3`} disabled={!canWrite} onClick={() => void execute('direct', 'Partial liquidation', progress => liquidateV2(loanId, progress))}>Execute configured partial liquidation</button></> : <p className="mt-2 text-sm text-amber-100">Not configured — fail closed. No collateral, debt, reserve, or LoanNFT state can be changed through this dashboard.</p>}</Card>}
      <details className="rounded-2xl border border-slate-700 bg-slate-900 p-5"><summary className="cursor-pointer font-semibold text-slate-100">Lending Referral</summary><div className="mt-4"><LendingReferralPanel wallet={wallet} canWrite={canWrite} /></div></details>
    </section>}
    {tab === 'p2p' && <section role="tabpanel" aria-label="P2P Marketplace" className="space-y-5">
      <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">P2P Marketplace</p><h3 className="text-2xl font-bold text-white">Open borrower requests, wallet-scoped positions, and canonical P2P status.</h3><p className="text-sm text-slate-300">The requester-led protocol lets an eligible non-borrower fund an OPEN request. Marketplace discovery never changes who owns a request or loan.</p></header>
      <div role="tablist" aria-label="P2P Marketplace views" className="flex flex-wrap gap-2 rounded-xl bg-slate-900 p-2">
        <button role="tab" aria-selected={p2pView === 'requests'} onClick={() => setP2PView('requests')} className={p2pView === 'requests' ? primary : secondary}>Borrow Requests</button>
        <button role="tab" aria-selected={p2pView === 'mine'} onClick={() => setP2PView('mine')} className={p2pView === 'mine' ? primary : secondary}>My P2P</button>
        <button role="tab" aria-selected={p2pView === 'status'} onClick={() => setP2PView('status')} className={p2pView === 'status' ? primary : secondary}>P2P Position / Status</button>
      </div>
      {p2pView === 'requests' && <section aria-label="Open Borrow Requests" className="space-y-5">
        <Card title="Open Borrow Requests">
          <p className="mb-4 text-sm text-slate-300">Shared discovery comes only from the canonical indexed OPEN-request API. A request stays here only while LoanMarketplaceV2 reports it as OPEN.</p>
          <ReadError error={openP2PRequests.error} retry={() => void openP2PRequests.reload().catch(() => {})} />
          {openP2PRequests.loading && <p role="status">Loading canonical open borrow requests…</p>}
          {!openP2PRequests.loading && !openP2PRequests.error && openP2PRequests.data?.length === 0 && <Empty>There are currently no OPEN borrow requests on this canonical deployment.</Empty>}
          <div className="grid gap-4 lg:grid-cols-2">{openP2PRequests.data?.map(entry => <OpenP2PRequestCard key={entry.requestId} request={entry} aprBps={p?.p2pAprBps} wallet={wallet} canWrite={canWrite} busy={busy} onView={() => selectP2PRequest(entry.requestId)} onFund={() => void execute('p2p', 'P2P funding', progress => fundV2Request(entry.requestId, progress))} />)}</div>
        </Card>
      </section>}
      {p2pView === 'mine' && <section aria-label="My P2P" className="space-y-5">
        <Card title="My P2P">
          <p className="mb-4 text-sm text-slate-300">Only request and loan records canonically associated with the connected wallet appear here. Shared marketplace rows do not imply ownership.</p>
          <ReadError error={history.error} retry={() => void history.reload().catch(() => {})} />
          {history.loading && <p role="status">Loading your canonical P2P positions…</p>}
          {history.data && <MyP2PPositions wallet={wallet} requests={history.data.requests} loans={history.data.loans} onRequest={selectP2PRequest} onLoan={selectP2PLoan} />}
          {!history.data && !history.loading && !history.error && <Empty>Connect a wallet to load your canonical P2P positions.</Empty>}
        </Card>
        <Card title="Create Borrow Request">
        <p className="text-sm text-slate-300">Create an ETH-collateral-backed request for another wallet to fund. The marketplace contract independently prices collateral through the canonical oracle and enforces the ETH-specific 35% initial LTV policy. A funded ETH P2P loan uses the canonical 9.25% whitepaper-table APR stored on that loan.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ABCD principal" value={p2pPrincipal} onChange={setP2pPrincipal} inputMode="decimal" />
          <Field label="ETH collateral" value={p2pCollateral} onChange={setP2pCollateral} inputMode="decimal" />
          <Term value={p2pTerm} onChange={setP2pTerm} />
        </div>
        <ReadError error={p2pCapacity.error} retry={() => void p2pCapacity.reload().catch(() => {})} />
        {p2pCapacity.loading && <p role="status">Reading canonical P2P ETH capacity from LoanMarketplaceV2…</p>}
        {p2pCapacity.data && <Metrics>
          <Metric label="Oracle collateral value" value={`$${p2pCapacity.data.collateralUSD}`} />
          <Metric label="P2P initial LTV" value={percent(p2pCapacity.data.initialLtvBps)} />
          <Metric label="P2P ETH APR" value={percent(p?.p2pAprBps)} />
          <Metric label="Maximum P2P principal" value={`${p2pCapacity.data.maxPrincipal} ABCD`} />
          <Metric label="Remaining capacity" value={p2pRemainingCapacity === 'Unavailable' ? 'Enter a valid principal' : `${p2pRemainingCapacity} ABCD`} />
        </Metrics>}
        {positiveAmount(p2pPrincipal) && p2pCapacity.data && !p2pWithinCapacity && <p role="alert" className="text-sm text-amber-200">Requested principal exceeds the contract-authoritative P2P capacity.</p>}
        <CompletionLifecycleNotice />
        <button className={primary} disabled={!canWrite || !p2pWithinCapacity || !validTerm(p2pTerm)} onClick={() => void execute('p2p', 'P2P request', progress => createV2Request(p2pPrincipal, p2pCollateral, Number(p2pTerm), progress))}>Create P2P request</button>
      </Card>
      </section>}
      {p2pView === 'status' && <section aria-label="P2P Position and Status" className="space-y-5">
      <Card title="P2P Request Status"><div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]"><Field label="Request ID" value={requestId} onChange={value => { select('requestId', value); select('p2pLoanId', ''); }} inputMode="numeric" /><button type="button" aria-label="Load P2P request from LoanMarketplaceV2" className={secondary} disabled={!validId(requestId) || request.loading} onClick={loadP2PRequest}>{request.loading ? 'Loading request…' : 'Load request'}</button></div>{!validId(requestId) && <p className="text-sm text-slate-400">Enter a real request ID, or select View from Borrow Requests or My P2P.</p>}<ReadError error={request.error} retry={loadP2PRequest} />{request.loading && <p role="status">Reading request directly from LoanMarketplaceV2…</p>}{currentRequest ? <><Metrics><Metric label="Request" value={`#${requestId}`} /><Metric label="Principal" value={`${currentRequest.principal} ABCD`} /><Metric label="Collateral" value={`${currentRequest.collateralETH} ETH`} /><Metric label="Term" value={`${Number(currentRequest.termSeconds) / 86400} days`} /><Metric label="Protocol APR" value={percent(p?.p2pAprBps)} /><Metric label="Borrower" value={currentRequest.borrower} /><Metric label="Status" value={p2pRequestStateLabel(currentRequest.state)} /><Metric label="Lender" value={currentRequest.state === 0 ? 'Awaiting funding' : currentRequest.lender} /></Metrics>{currentRequest.state === 0 ? <button className={primary} disabled={!canWrite || sameWallet(currentRequest.borrower, wallet)} onClick={() => void execute('p2p', 'P2P funding', progress => fundV2Request(requestId, progress))}>Approve ABCD & fund request</button> : validId(currentRequest.loanId) ? <button className={secondary} onClick={() => selectP2PLoan(currentRequest.loanId)}>View funded loan #{currentRequest.loanId}</button> : null}<P2PRequestHistory requestId={requestId} /></> : <Empty>Load a canonical request to review its status and lifecycle evidence.</Empty>}</Card>
      <Card title="Funded P2P Loan & EMI"><LoanSelector value={p2pLoanId} onChange={value => select('p2pLoanId', value)} records={knownLoans.filter(record => Boolean((record.loan as Record<string, unknown> | undefined)?.isP2P))} /><ReadError error={peerLoan.error} retry={() => void peerLoan.reload().catch(() => {})} />{peerLoan.loading && <p role="status">Reading P2P loan…</p>}{peerLoan.data?.isDirect && <Empty>This is a direct loan. Open it under Direct Lending.</Empty>}{p2pLoan ? <><LoanStatus loan={p2pLoan} loanId={p2pLoanId} wallet={wallet} />{p2pLoan.state === 6 && sameWallet(p2pLoan.borrower, wallet) && <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"><p className="font-bold text-amber-100">P2P Margin Call Active</p><p className="text-sm text-amber-100">Add ETH collateral before {timestamp(p2pLoan.marginCallCureEnd)} to cure the position. The canonical pool/vault applies the top-up to this exact P2P loan ID.</p><Field label="Additional P2P ETH collateral" inputMode="decimal" value={p2pTopUp} onChange={setP2pTopUp} /><button className={primary} disabled={!canWrite || !peerActions.topUp || !positiveAmount(p2pTopUp)} onClick={() => void execute('p2p', 'P2P loan collateral top-up', progress => addV2LoanCollateral(p2pLoanId, p2pTopUp, progress))}>Add P2P collateral to cure</button><button className={secondary} disabled={!canWrite} onClick={() => void execute('p2p', 'P2P risk-state synchronization', progress => syncV2LoanRisk(p2pLoanId, progress))}>Sync P2P risk state</button></div>}{p2pLoanClosed ? <ClosedLoanRecoveryNotice /> : p2pLoan.schedule ? <><Metrics><Metric label="Next EMI" value={`${p2pLoan.schedule.installmentAmount} ABCD`} /><Metric label="Recovery state" value={p2pLoan.schedule.state} /><Metric label="Amount applied" value={`${p2pLoan.schedule.amountApplied} ABCD`} /><Metric label="Remaining scheduled due" value={`${p2pLoan.schedule.remainingDue} ABCD`} /><Metric label="Installments paid" value={`${p2pLoan.schedule.paidInstallments} / ${p2pLoan.schedule.installmentCount}`} /><Metric label="Next due" value={timestamp(p2pLoan.schedule.nextDueAt)} /></Metrics>{!p2pLoan.schedule.completed && !p2pLoan.schedule.due && <p role="status" className="text-sm text-amber-200">The next EMI is not due yet. Eligibility is read from the canonical chain block timestamp.</p>}{sameWallet(p2pLoan.borrower, wallet) && <CompletionSettlementNotice busy={completionBusy} message={completionMessage} metadata={publishedCompletionMetadata} />}<button className={primary} disabled={!canWrite || !peerActions.repay || p2pLoan.schedule.completed || !p2pLoan.schedule.due || completionBusy} onClick={() => void execute('p2p', 'EMI payment', progress => payV2Emi(p2pLoanId, prepareCompletionMetadata, progress))}>Approve ABCD & pay next EMI</button></> : <Empty>No EMI schedule is available for this loan.</Empty>}</> : <Empty>Load a funded P2P loan to review its canonical position and EMI schedule.</Empty>}</Card>
      {p2pLoan && <P2PAdverseRecoveryEvidence recovery={peerRecovery.data} loading={peerRecovery.loading} error={peerRecovery.error} retry={() => void peerRecovery.reload().catch(() => {})} />}
      <Card title="Settlement & Default Recovery">{p2pLoanClosed ? <ClosedLoanRecoveryNotice /> : p2pLoan ? <><Field label="Outstanding ABCD payment" value={p2pPayment} onChange={setP2pPayment} inputMode="decimal" /><button className={secondary} disabled={!canWrite || !peerActions.repay || !withinCapacity(p2pPayment, p2pLoan.outstanding) || completionBusy} onClick={() => void execute('p2p', 'Outstanding EMI repayment', progress => payV2OutstandingEmi(p2pLoanId, p2pPayment, prepareCompletionMetadata, progress))}>Approve ABCD & settle outstanding</button><p className="text-sm text-slate-300">Borrower-initiated repayment remains available through the canonical EMI and marketplace contracts.</p>{p2pLoan.schedule && <button className={secondary} disabled={!canWrite || p2pLoan.schedule.completed || !p2pLoan.schedule.due} onClick={() => void execute('p2p', 'Due-installment collateral recovery', progress => executeV2OverdueEmi(p2pLoanId, progress))}>Execute due collateral recovery</button>}<div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3"><p className="text-sm text-amber-100">Approved P2P adverse recovery is represented only by canonical on-chain state and indexed evidence: partial recovery remains ACTIVE/FUNDED with locked collateral; terminal recovery becomes LIQUIDATED/RECOVERED or RESIDUAL_DEBT/DEFAULTED. This view never infers a confirmed recovery from a submitted transaction.</p></div></> : <Empty>Load a funded request and loan to review borrower repayment and canonical recovery evidence.</Empty>}</Card>
      </section>}
    </section>}
    <Card title="On-chain Verification & Positions">
      <ReadError error={history.error} retry={() => void history.reload().catch(() => {})} />
      {history.loading && <p role="status">Loading confirmed wallet history…</p>}
      {history.data ? <><Metrics><Metric label="Direct positions" value={String(history.data.directPositions.length)} /><Metric label="Loans" value={String(history.data.loans.length)} /><Metric label="Indexed events" value={String(history.data.events.length)} /></Metrics><div className="flex flex-wrap gap-2">{history.data.directPositions.filter(value => value.active).map(value => <button key={value.depositId} className={secondary} onClick={() => { select('depositId', value.depositId); setTab('direct'); }}>Deposit #{value.depositId}</button>)}{history.data.requests.map(value => <button key={value.requestId} className={secondary} onClick={() => { select('requestId', value.requestId); setTab('p2p'); }}>Request #{value.requestId}</button>)}</div><details><summary className="cursor-pointer text-sm text-cyan-200">Confirmed events</summary><ul className="mt-3 space-y-2 text-xs text-slate-300">{history.data.events.map((event, index) => <li key={String(event._id || index)} className="break-all">{String(event.eventName || 'Event')} — block {String(event.blockNumber ?? 'Unavailable')} — {String(event.transactionHash || 'Transaction unavailable')}</li>)}</ul></details></> : !history.loading && !history.error && <Empty>Connect a wallet to read confirmed history.</Empty>}
    </Card>
    <details className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <summary className="cursor-pointer font-semibold text-slate-200">Advanced Protocol Details</summary>
      <div className="mt-4 space-y-4"><p className="text-sm text-amber-200">Local Hardhat only — chain 31337. Oracle feeds are local mocks and are not production prices.</p><ReadError error={protocol.error} retry={() => void protocol.reload().catch(() => {})} />
        {p && <Metrics><Metric label="Direct initial LTV" value={percent(p.initialLtvBps)} /><Metric label="Direct new-loan APR" value={percent(p.aprBps)} /><Metric label="P2P ETH initial LTV" value={percent(p.p2pInitialLtvBps)} /><Metric label="P2P ETH APR" value={percent(p.p2pAprBps)} /><Metric label="Margin-call threshold" value={percent(p.marginCallThresholdBps)} /><Metric label="Cure period" value={`${Number(p.marginCallCureSeconds) / 3600} hours`} /><Metric label="Partial-liquidation threshold" value={percent(p.liquidationThresholdBps)} /><Metric label="Restoration target" value={percent(p.partialLiquidationTargetLtvBps)} /><Metric label="Partial-sale execution" value={p.partialLiquidationExecution === 'CONFIGURED' ? 'Configured — local test-only; not production policy' : 'Not configured — fail closed'} /><Metric label="Terms (deployment configuration)" value={p.supportedTermsDays?.join(' / ') || 'Unavailable'} /><Metric label="Maturity grace (deployment configuration)" value={p.gracePeriodDays ? `${p.gracePeriodDays} days` : 'Unavailable'} /><Metric label="Pool liquidity" value={`${p.poolLiquidity} ABCD`} /><Metric label="Pool balance" value={`${p.poolTokenBalance} ABCD`} /><Metric label="Insurance reserve" value={`${p.reserveBalance} ABCD`} /><Metric label="Local oracle prices" value={`ETH $ ${p.ethUsd}; ABCD $ ${p.abcdUsd}`} /></Metrics>}
        <ReadError error={reserveRead.error} retry={() => void reserveRead.reload().catch(() => {})} />
        {reserveRead.data && <ReserveEvidence reserve={reserveRead.data} />}
        <p className="text-xs text-slate-400">V2 deployment block: {getLendingV2DeploymentBlock() ?? 'Unavailable'}. Source: canonical lendingV2 manifest and isolated V2 event projection.</p><dl className="space-y-2">{Object.entries(contracts).map(([name, value]) => <div key={name} className="text-xs"><dt className="text-slate-400">{name}</dt><dd className="break-all font-mono text-slate-200">{value}</dd></div>)}</dl>
      </div>
    </details>
    <details className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <summary className="cursor-pointer font-semibold text-slate-200">Developer / Certification Details</summary>
      <div className="mt-4 space-y-3 text-sm text-slate-300"><p>Local certification runtime only — chain 31337. Deployment and checkpoint evidence remain available here and never replaces canonical contract reads.</p><p>V2 deployment block: {getLendingV2DeploymentBlock() ?? 'Unavailable'}.</p><dl className="space-y-2">{Object.entries(contracts).map(([name, value]) => <div key={name} className="text-xs"><dt className="text-slate-400">{name}</dt><dd className="break-all font-mono text-slate-200">{value}</dd></div>)}</dl></div>
    </details>
  </section>;
};

function DirectLoanSummary({ loan, loanId, actions, canWrite, onRepay, onCollateral }: { loan: V2Read | null; loanId: string; actions: { repay: boolean; topUp: boolean; withdraw: boolean }; canWrite: boolean; onRepay: () => void; onCollateral: () => void }) {
  if (!loan) return <section className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Direct Lending</p><h3 className="mt-1 text-xl font-bold text-white">No active loan selected</h3><p className="mt-2 text-sm text-slate-300">Deposit collateral to start, or load a confirmed Direct Lending loan below. Canonical values appear only after the loan is read.</p></section>;
  const terminal = [4, 5, 7].includes(loan.state);
  return <section className="space-y-4 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-slate-900 p-5 sm:p-6" aria-label="Active Loan Summary">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">Active Loan Summary</p><h3 className="mt-1 text-2xl font-bold text-white">Loan #{loanId}</h3></div><span className="rounded-full border border-cyan-300/40 px-3 py-1 text-xs font-bold text-cyan-100">{stateLabel(loan.state).toUpperCase()}</span></div>
    <Metrics><Metric label="Principal" value={`${loan.principal} ABCD`} /><Metric label="Current outstanding debt" value={`${loan.outstanding} ABCD`} /><Metric label="Current collateral" value={`${loan.currentVaultCollateralETH} ETH`} /><Metric label="Current LTV" value={terminal ? 'Not applicable' : loan.ltvBps === null ? 'Unavailable' : percent(loan.ltvBps)} /><Metric label="APR" value={percent(loan.aprBps)} /><Metric label="Maturity" value={timestamp(loan.maturity)} /></Metrics>
    <div className="flex flex-wrap gap-3"><button type="button" className={primary} disabled={!canWrite || !actions.repay} onClick={onRepay}>Repay Loan</button><button type="button" className={secondary} disabled={!canWrite || !actions.topUp} onClick={onCollateral}>Add Collateral</button></div>
    {!actions.repay && terminal && <p className="text-sm text-slate-300">This loan is terminal. No repayment action is inferred from this summary.</p>}
  </section>;
}

function LoanLifecycle({ loan }: { loan: V2Read }) {
  const settled = loan.state === 5 && !positiveAmount(loan.outstanding);
  const current = settled ? 'Closed' : stateLabel(loan.state);
  const steps = ['Collateral Deposited', 'ABCD Borrowed', 'Loan Active', 'Repayment', 'Fully Repaid', 'Completion Certificates', 'Collateral Released', 'Closed'];
  return <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5" aria-label="Loan Lifecycle"><h3 className="text-lg font-bold text-white">Loan Lifecycle</h3><p className="mt-1 text-sm text-slate-300">Current canonical state: <strong>{current}</strong>. This timeline is a state guide, not evidence of a completed action.</p><ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <li key={step} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-200"><span className="mr-2 text-cyan-300">{index + 1}.</span>{step}</li>)}</ol></section>;
}

export function V2BorrowForm({ deposit, principal, setPrincipal, term, setTerm, blocker, busy, apr, ltv, onBorrow }: { deposit: V2PendingDeposit | null; principal: string; setPrincipal: (v: string) => void; term: string; setTerm: (v: string) => void; blocker: string | null; busy: boolean; apr?: string; ltv?: string; onBorrow: () => void }) {
  return <div data-testid="v2-borrow-form" className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
    <h4 className="font-bold text-emerald-100">Borrow against deposit</h4>
    <Field label="ABCD principal" inputMode="decimal" value={principal} onChange={setPrincipal} />
    <p className="text-sm text-emerald-200">Available: {deposit?.active ? deposit.maxBorrowable : 'Unavailable'} ABCD</p>
    <Term value={term} onChange={setTerm} />
    <Metrics><Metric label="Requested principal" value={positiveAmount(principal) ? `${principal} ABCD` : 'Enter amount'} /><Metric label="Collateral" value={deposit ? `${deposit.collateralETH} ETH` : 'Unavailable'} /><Metric label="Maximum LTV" value={percent(ltv)} /><Metric label="APR for a new loan" value={percent(apr)} /><Metric label="Term" value={validTerm(term) ? `${term} days` : 'Choose term'} /><Metric label="Maturity" value="Set by the mined borrow transaction" /></Metrics>
    {blocker && <p role="status" className="text-sm text-amber-200">{blocker}</p>}
    <button type="button" aria-label="Borrow ABCD against active V2 deposit" className={primary} disabled={busy || !!blocker} onClick={onBorrow}>{positiveAmount(principal) ? `Borrow ${principal} ABCD` : 'Borrow ABCD'}</button>
  </div>;
}
function CompletionLifecycleNotice() {
  return <p className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-slate-300">Completion LoanNFTs are not created at origination. During a full-settlement action, ABCDeFi prepares genuine role-specific IPFS provenance; the same successful repayment transaction atomically mints the lender, borrower, and platform certificates.</p>;
}
export function LendingReferralPanel({ wallet, canWrite }: { wallet: string; canWrite: boolean }) {
  const [snapshot, setSnapshot] = useState<LendingReferralSnapshot | null>(null);
  const [code, setCode] = useState(''); const [bindCode, setBindCode] = useState('');
  const [claimLoanId, setClaimLoanId] = useState(''); const [referred, setReferred] = useState('');
  const [record, setRecord] = useState<{ registered: boolean; paidPeriods: string; totalRewards: string; monthlyReward: string; completedAt: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null); const [tx, setTx] = useState<LendingReferralTransaction | null>(null); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    if (!wallet) return;
    const [next, nextRecord] = await Promise.all([getLendingReferralSnapshot(wallet), getLendingReferralRecord(claimLoanId, referred)]);
    setSnapshot(next); setRecord(nextRecord);
  }, [wallet, claimLoanId, referred]);
  useEffect(() => { void refresh().catch(error => setMessage(lendingV2ErrorMessage(error))); }, [refresh]);
  const run = async (action: () => Promise<LendingReferralTransaction>) => {
    setBusy(true); setMessage('Waiting for MetaMask confirmation…'); setTx(null);
    try { const result = await action(); setTx(result); setMessage('Confirmed on-chain.'); await refresh(); }
    catch (error) { setMessage(lendingV2ErrorMessage(error)); }
    finally { setBusy(false); }
  };
  return <Card title="Lending referral relationship">
    <p className="text-sm text-slate-300">This is the canonical LendingReferralManagerV2, separate from legacy ICO referrals. It accrues 0.05% monthly accounting periods and permits one aggregate payout only after a successful loan completion or the contract’s one-year boundary.</p><p className="text-xs text-slate-400">These optional wallet-level controls let you create a code, bind an existing referrer, or claim a reward already earned by the canonical contract. They do not create or alter referral eligibility.</p>
    <Metrics><Metric label="Lending referral contract" value={snapshot?.address || 'Reading'} /><Metric label="Monthly accrual basis" value={snapshot ? `${Number(snapshot.monthlyRewardBps) / 100}%` : 'Reading'} /><Metric label="Reward vault" value={snapshot?.rewardVault || 'Reading'} /><Metric label="Bound referrer" value={snapshot?.referrer || 'None'} /></Metrics>
    {snapshot?.code ? <Metric label="Your on-chain lending code" value={snapshot.code} /> : <div className="grid items-end gap-3 sm:grid-cols-2"><Field label="Choose your lending referral code" value={code} onChange={setCode} /><button className={secondary} disabled={!canWrite || busy || code.trim().length < 4} onClick={() => void run(() => createLendingReferralCode(code))}>Create lending code</button></div>}
    {!snapshot?.referrer && <div className="grid items-end gap-3 sm:grid-cols-2"><Field label="Enter a referrer’s lending code" value={bindCode} onChange={setBindCode} /><button className={secondary} disabled={!canWrite || busy || !bindCode.trim()} onClick={() => void run(() => bindLendingReferrer(bindCode))}>Bind lending referrer</button></div>}
    <div className="grid items-end gap-3 sm:grid-cols-3"><Field label="Completed loan ID" inputMode="numeric" value={claimLoanId} onChange={setClaimLoanId} /><Field label="Referred participant wallet" value={referred} onChange={setReferred} /><button className={secondary} disabled={!canWrite || busy || !validId(claimLoanId) || !/^0x[a-fA-F0-9]{40}$/.test(referred)} onClick={() => void run(() => claimLendingAccruedReward(claimLoanId, referred))}>Claim available lending reward</button></div><p className="text-xs text-slate-400">Claiming requires the completed loan ID and the referral participant already recorded by the canonical contract.</p>
    {record && <Metrics><Metric label="Registered for this loan" value={record.registered ? 'Yes' : 'No'} /><Metric label="Accrued periods already paid" value={record.paidPeriods} /><Metric label="Aggregate rewards paid" value={`${record.totalRewards} ABCD`} /><Metric label="Monthly entitlement" value={`${record.monthlyReward} ABCD`} /></Metrics>}
    {tx && <p className="break-all text-xs text-emerald-200">Referral transaction: {tx.hash} (block {tx.blockNumber})</p>}{message && <p role="status" className="text-sm text-cyan-200">{message}</p>}
  </Card>;
}
function CompletionSettlementNotice({ busy, message, metadata }: { busy: boolean; message: string | null; metadata: PublishedCompletionMetadata | null }) {
  return <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"><h4 className="font-semibold text-violet-100">Completion LoanNFT certificates</h4><p className="text-xs text-slate-300">On a full settlement, the authenticated ABCDeFi platform prepares three genuine public-IPFS provenance records from canonical loan state, then the same settlement transaction mints the lender, borrower, and platform certificates. No borrower artwork, manual URI, or manual hash is accepted.</p>{busy && <p role="status" className="text-xs text-cyan-200">Preparing completion records…</p>}{message && <p role="status" className="break-all text-xs text-cyan-200">{message}</p>}{metadata && <Metrics><Metric label="Lender metadata URI" value={metadata.lender.metadataUri} /><Metric label="Borrower metadata URI" value={metadata.borrower.metadataUri} /><Metric label="Platform metadata URI" value={metadata.platform.metadataUri} /></Metrics>}</div>;
}
function shortWallet(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address) ? `${address.slice(0, 6)}…${address.slice(-5)}` : 'Unavailable';
}
function p2pTermDays(termSeconds: string) {
  const seconds = Number(termSeconds);
  return Number.isSafeInteger(seconds) && seconds > 0 && seconds % 86400 === 0 ? `${seconds / 86400} days` : 'Unavailable';
}
function p2pDisplayAmount(value: string) {
  try {
    return /^\d+$/.test(value) ? formatEther(BigInt(value)) : value;
  } catch {
    return 'Unavailable';
  }
}
function OpenP2PRequestCard({ request, aprBps, wallet, canWrite, busy, onView, onFund }: { request: V2OpenP2PRequest; aprBps?: string; wallet: string; canWrite: boolean; busy: boolean; onView: () => void; onFund: () => void }) {
  const borrowerOwnsRequest = sameWallet(request.borrower, wallet);
  return <article className="space-y-4 rounded-xl border border-slate-700 bg-slate-950/30 p-4" data-testid={`open-p2p-request-${request.requestId}`}>
    <div className="flex items-center justify-between gap-3"><h4 className="font-semibold text-white">Request #{request.requestId}</h4><span className="rounded-full border border-emerald-400/40 px-2 py-1 text-xs font-semibold text-emerald-200">OPEN</span></div>
    <Metrics><Metric label="Borrower" value={shortWallet(request.borrower)} /><Metric label="Requested principal" value={`${request.principal} ABCD`} /><Metric label="Collateral" value={`${request.collateralETH} ETH`} /><Metric label="Term" value={p2pTermDays(request.termSeconds)} /><Metric label="Protocol APR" value={percent(aprBps)} /><Metric label="Initial LTV" value={percent(request.initialLtvBps)} /></Metrics>
    <div className="flex flex-wrap gap-3"><button type="button" className={secondary} onClick={onView}>View</button>{!borrowerOwnsRequest && <button type="button" className={primary} disabled={!canWrite || busy} onClick={onFund}>Approve ABCD & fund request</button>}</div>
    {borrowerOwnsRequest && <p className="text-xs text-slate-400">This is your request. Only another eligible wallet can fund it.</p>}
  </article>;
}
function MyP2PPositions({ wallet, requests, loans, onRequest, onLoan }: { wallet: string; requests: V2Request[]; loans: Array<Record<string, unknown>>; onRequest: (requestId: string) => void; onLoan: (loanId: string) => void }) {
  const ownRequests = requests.filter(request => sameWallet(request.borrower, wallet));
  const p2pLoans = loans.filter(record => {
    const loan = record.loan as Record<string, unknown> | undefined;
    return Boolean(loan?.isP2P) && (sameWallet(String(loan?.borrower || ''), wallet) || sameWallet(String(loan?.lender || ''), wallet));
  });
  return <div className="space-y-5">
    <section aria-label="My Borrow Requests" className="space-y-3"><h4 className="font-semibold text-slate-100">My Borrow Requests</h4>{ownRequests.length ? <div className="grid gap-3 lg:grid-cols-2">{ownRequests.map(request => <article key={request.requestId} className="rounded-xl border border-slate-700 bg-slate-950/30 p-4"><Metrics><Metric label="Request" value={`#${request.requestId}`} /><Metric label="Principal" value={`${p2pDisplayAmount(request.principal)} ABCD`} /><Metric label="Collateral" value={`${p2pDisplayAmount(request.collateralETH)} ETH`} /><Metric label="Term" value={p2pTermDays(request.termSeconds)} /><Metric label="Status" value={p2pRequestStateLabel(request.state)} /></Metrics><button type="button" className={`${secondary} mt-3`} onClick={() => onRequest(request.requestId)}>View request</button></article>)}</div> : <Empty>No canonical P2P borrow requests belong to this wallet.</Empty>}</section>
    <section aria-label="My Funded P2P Loans" className="space-y-3"><h4 className="font-semibold text-slate-100">My Funded P2P Loans</h4>{p2pLoans.length ? <div className="grid gap-3 lg:grid-cols-2">{p2pLoans.map(record => { const loan = record.loan as Record<string, unknown>; const loanId = String(record.loanId || ''); return <article key={loanId} className="rounded-xl border border-slate-700 bg-slate-950/30 p-4"><Metrics><Metric label="Loan" value={`#${loanId}`} /><Metric label="Role" value={sameWallet(String(loan.borrower || ''), wallet) ? 'Borrower' : 'Lender'} /><Metric label="Principal" value={`${p2pDisplayAmount(String(loan.principal || 'Unavailable'))} ABCD`} /><Metric label="Status" value={stateLabel(Number(loan.state))} /></Metrics><button type="button" className={`${secondary} mt-3`} onClick={() => onLoan(loanId)}>View P2P loan</button></article>; })}</div> : <Empty>No canonical funded P2P loans belong to this wallet.</Empty>}</section>
  </div>;
}
function LoanSelector({ value, onChange, records }: { value: string; onChange: (v: string) => void; records: Array<Record<string, unknown>> }) {
  return <div className="space-y-3"><Field label="Loan ID" inputMode="numeric" value={value} onChange={onChange} /><div className="flex flex-wrap gap-2">{records.filter(record => validId(String(record.loanId))).map(record => <button key={String(record.loanId)} className={secondary} onClick={() => onChange(String(record.loanId))}>Load loan #{String(record.loanId)}</button>)}</div></div>;
}

export function p2pRequestStateLabel(state: number) {
  return ['Open', 'Funded', 'Cancelled', 'Settled', 'Recovered', 'Defaulted — residual debt remains'][state] || `Unknown (${state})`;
}

function P2PRequestHistory({ requestId }: { requestId: string }) {
  const serial = useRef(0);
  const [page, setPage] = useState<V2P2PRequestHistory | null>(null);
  const [events, setEvents] = useState<V2P2PRequestHistory['history']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (cursor: string | null, replace: boolean) => {
    const request = ++serial.current;
    setLoading(true); setError(null);
    try {
      const next = await getV2P2PRequestHistory(requestId, { limit: 20, cursor });
      if (request !== serial.current) return;
      setPage(next);
      setEvents(previous => replace ? next.history : [...previous, ...next.history]);
    } catch (reason) {
      if (request === serial.current) setError(lendingV2ErrorMessage(reason));
    } finally {
      if (request === serial.current) setLoading(false);
    }
  }, [requestId]);
  useEffect(() => { void load(null, true); return () => { ++serial.current; }; }, [load]);
  return <section aria-label="Canonical P2P request history" className="mt-4 space-y-3 rounded-xl border border-slate-700 bg-slate-950/30 p-4">
    <h3 className="font-semibold text-slate-100">Canonical P2P request history</h3>
    <p className="text-xs text-slate-400">Deployment-scoped LoanMarketplaceV2 lifecycle events, in the canonical API order.</p>
    {loading && !events.length && <p role="status" className="text-sm text-cyan-200">Reading canonical P2P request history…</p>}
    {error && <ReadError error={error} retry={() => { void load(null, true); }} />}
    {events.length ? <ol className="space-y-2 text-xs text-slate-300">{events.map(event => <li key={`${event.transactionHash}:${event.logIndex}`} className="break-all">{event.eventName} — block {event.blockNumber} — log {event.logIndex} — {event.transactionHash}</li>)}</ol> : !loading && !error && <Empty>No canonical P2P lifecycle events are indexed for this request.</Empty>}
    {page?.nextCursor && <button type="button" className={secondary} disabled={loading} onClick={() => { void load(page.nextCursor, false); }}>{loading ? 'Loading history…' : 'Load more history'}</button>}
  </section>;
}

function P2PAdverseRecoveryEvidence({ recovery, loading, error, retry }: { recovery: V2CanonicalP2PLoan | null; loading: boolean; error: string | null; retry: () => void }) {
  const events = recovery?.adverseRecovery || [];
  return <section aria-label="Canonical P2P adverse recovery evidence" className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
    <h3 className="font-semibold text-amber-100">Canonical P2P adverse recovery evidence</h3>
    <p className="text-xs text-amber-100">Only deployment-scoped indexed events are shown. A submitted transaction is not recovery confirmation.</p>
    {loading && <p role="status" className="text-sm text-amber-100">Reconciling canonical recovery evidence…</p>}
    {error && <ReadError error={error} retry={retry} />}
    {recovery && <Metrics><Metric label="Canonical checkpoint" value={recovery.checkpoint} /><Metric label="Loan state" value={stateLabel(Number(recovery.loan.state))} /><Metric label="Outstanding debt" value={`${formatEther(recovery.previews.outstanding)} ABCD`} /><Metric label="Residual bad debt" value={`${formatEther(recovery.loan.badDebt)} ABCD`} /><Metric label="Reserve contribution" value={`${formatEther(recovery.loan.reserveContribution)} ABCD`} /></Metrics>}
    {events.length ? <ol className="space-y-2 text-xs text-slate-200">{events.map(event => <li key={`${event.transactionHash}:${event.logIndex}`} className="break-all">{event.eventName} — block {event.blockNumber} — log {event.logIndex} — {event.transactionHash}</li>)}</ol> : recovery && <Empty>No canonical adverse-recovery event is indexed for this loan.</Empty>}
  </section>;
}

function LoanStatus({ loan, loanId, wallet }: { loan: V2Read; loanId: string; wallet: string }) {
  const closedWithoutCollateral = loan.state === 5 && !positiveAmount(loan.currentVaultCollateralETH);
  return <div className="space-y-4"><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Status" value={stateLabel(loan.state)} /><Metric label="Principal" value={`${loan.principal} ABCD`} /><Metric label="Original collateral" value={`${loan.originalCollateralETH} ETH`} /><Metric label="Current vault collateral" value={`${loan.currentVaultCollateralETH} ETH`} /><Metric label="Current debt" value={`${loan.outstanding} ABCD`} /><Metric label="Accrued interest" value={`${loan.accruedInterest} ABCD`} /><Metric label="Reserve contribution" value={`${loan.reserveContribution} ABCD`} /><Metric label="Bad debt" value={`${loan.badDebt} ABCD`} /><Metric label="Agreed APR" value={percent(loan.aprBps)} /><Metric label="Maturity" value={timestamp(loan.maturity)} /><Metric label="Current LTV" value={closedWithoutCollateral ? 'Not applicable' : positiveAmount(loan.currentVaultCollateralETH) ? percent(loan.ltvBps) : 'No remaining collateral'} /><Metric label="Margin call" value={loan.state === 6 ? 'Active' : 'Not active'} /><Metric label="Margin-call deadline" value={loan.state === 6 || loan.state === 3 ? timestamp(loan.marginCallCureEnd) : 'Not applicable'} /><Metric label="Partial liquidation" value={loan.state === 5 ? 'Not applicable — loan closed' : loan.liquidatable === null ? 'Unavailable — refresh risk reads' : loan.liquidatable ? 'Required — see configured route status below' : 'Not required'} /></Metrics>
    {closedWithoutCollateral && <p role="status" className="text-sm text-slate-300">Loan closed; collateral released.</p>}
    {loan.riskError && <p role="alert" className="text-sm text-amber-200">Risk/oracle data unavailable: {loan.riskError}. Debt and collateral above remain contract reads.</p>}
    {loan.certificates.filter(certificate => sameWallet(certificate.owner, wallet)).length ? <details><summary className="cursor-pointer text-sm text-cyan-200">Completion Certificates</summary>{loan.certificates.filter(certificate => sameWallet(certificate.owner, wallet)).map(certificate => <Metrics key={certificate.tokenId}><Metric label="Certificate role" value={certificate.role} /><Metric label="Token ID" value={certificate.tokenId} /><Metric label="Owner" value={certificate.owner} /><Metric label="Loan association" value={certificate.loanId} /><Metric label="Metadata URI" value={certificate.uri || 'Unavailable'} /><Metric label="Metadata hash" value={certificate.hash || 'Unavailable'} /><Metric label="Informational 1% USD valuation" value={`${certificate.valuation} USD`} /><Metric label="Valuation feed" value={certificate.valuationFeed} /><Metric label="Valuation round" value={certificate.valuationRoundId} /><Metric label="Valuation updated" value={timestamp(certificate.valuationUpdatedAt)} /><Metric label="ABCD/USD snapshot" value={`${certificate.completionABCDUSDPrice} USD`} /><Metric label="Formula version" value={certificate.formulaVersion} /><Metric label="Completion time" value={timestamp(certificate.completedAt)} /><Metric label="Completion block" value={certificate.completionBlock} /></Metrics>)}</details> : <Empty>Certificates are created after successful full repayment.</Empty>}
    <details><summary className="cursor-pointer text-sm text-slate-400">Advanced / Contract Details</summary><Metrics><Metric label="Borrower" value={loan.borrower} /><Metric label="Lender" value={loan.lender} /><Metric label="Health factor (contract raw value)" value={loan.healthFactor ?? 'Unavailable'} /><Metric label="Contractual total at maturity (not current payoff)" value={`${loan.totalRepayment} ABCD`} /><Metric label="Loan start" value={timestamp(loan.start)} /></Metrics></details>
  </div>;
}

function ClosedLoanRecoveryNotice() {
  return <div className="space-y-2"><Metrics><Metric label="Recovery state" value="Not applicable" /><Metric label="Exact remaining due" value="Not applicable" /><Metric label="Due time" value="Not applicable" /></Metrics><p role="status" className="text-sm text-slate-300">Loan is closed and has no outstanding debt.</p></div>;
}

function ReserveEvidence({ reserve }: { reserve: { balance: string; reserveCoverCapABCD: string; payoutEvents: V2ReserveEvent[]; checkpoint: string | null; deploymentVersion: string | null } }) {
  return <section aria-label="Canonical Reserve evidence" className="space-y-3 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4"><h3 className="font-semibold text-cyan-100">Canonical Reserve evidence</h3><Metrics><Metric label="Live Reserve balance" value={`${formatEther(reserve.balance)} ABCD`} /><Metric label="Reserve cover cap" value={`${formatEther(reserve.reserveCoverCapABCD)} ABCD`} /><Metric label="Canonical checkpoint" value={reserve.checkpoint ?? 'Unavailable'} /></Metrics>{reserve.payoutEvents.length ? <ul className="space-y-2 text-xs text-slate-300">{reserve.payoutEvents.map((event, index) => <li key={`${String(event.transactionHash || index)}:${String(event.logIndex ?? index)}`} className="break-all">ReserveUsed — loan #{String(event.args?.loanId ?? 'Unavailable')} — paid {formatReserveAmount(event.args?.paid)} ABCD — block {String(event.blockNumber ?? 'Unavailable')} — {String(event.transactionHash ?? 'Transaction unavailable')}</li>)}</ul> : <Empty>No canonical Reserve payout is indexed for this deployment.</Empty>}<p className="text-xs text-slate-400">Source: deployment-scoped canonical Reserve API{reserve.deploymentVersion ? ` (${reserve.deploymentVersion})` : ''}.</p></section>;
}

function formatReserveAmount(value: unknown) {
  try { return typeof value === 'string' || typeof value === 'bigint' ? formatEther(value) : 'Unavailable'; } catch { return 'Unavailable'; }
}
