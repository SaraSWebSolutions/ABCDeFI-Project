import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther, parseEther } from 'ethers';
import { useWallet } from '../Context/WalletContext';
import { getLendingV2Contracts, getLendingV2DeploymentBlock } from '../Config/contracts';
import {
  addV2LoanCollateral, borrowV2, createV2Request, depositV2Collateral, fundV2Request,
  getV2LatestDirectLoanForWallet, getV2LatestPendingDepositForWallet, getV2Loan, getV2PendingDeposit, getV2ProtocolState,
  getV2P2PRequestCapacity, getV2Request, getV2WalletHistory, lendingV2ErrorMessage,
  executeV2OverdueEmi, liquidateV2, payV2DirectInstallment, payV2Emi, payV2OutstandingEmi, repayAllV2, repayV2, stateLabel,
  syncV2LoanRisk, withdrawV2Collateral,
  type CompletionCertificateMetadata, type V2PendingDeposit, type V2ProgressListener, type V2Read, type V2Tx,
} from '../Services/lendingV2';
import { borrowBlocker, directStage, loanActions, positiveAmount, sameAmount, sameWallet, validId, validTerm, withinCapacity } from '../Utils/lendingV2Flow';
import { prepareLoanCompletionMetadata, type PublishedCompletionMetadata } from '../Services/lendingV2Metadata';
import { bindLendingReferrer, claimLendingAccruedReward, createLendingReferralCode, getLendingReferralRecord, getLendingReferralSnapshot, type LendingReferralSnapshot, type LendingReferralTransaction } from '../Services/lendingReferralV2';
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

type Scope = 'direct' | 'p2p';
type Selection = { wallet: string; depositId: string; loanId: string; requestId: string; p2pLoanId: string };
const emptySelection = (wallet: string): Selection => ({ wallet, depositId: '', loanId: '', requestId: '', p2pLoanId: '' });

export const LendingV2: React.FC = () => {
  const { address, isConnected, isCorrectNetwork, refreshBalances } = useWallet();
  const contracts = getLendingV2Contracts();
  const wallet = isConnected && address ? address.toLowerCase() : '';
  const walletRef = useRef(wallet); walletRef.current = wallet;
  const [selection, setSelection] = useState<Selection>(() => emptySelection(wallet));
  const selected = selection.wallet === wallet ? selection : emptySelection(wallet);
  const { depositId, loanId, requestId, p2pLoanId } = selected;
  const select = (field: keyof Omit<Selection, 'wallet'>, value: string) => setSelection(previous => ({ ...(previous.wallet === wallet ? previous : emptySelection(wallet)), [field]: value }));
  const [tab, setTab] = useState<Scope>('direct');
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
  const [depositReceipt, setDepositReceipt] = useState<V2Tx | null>(null);
  const [discovery, setDiscovery] = useState<{ wallet: string; loading: boolean; error: string | null }>({ wallet: '', loading: false, error: null });
  const [discoveryAttempt, setDiscoveryAttempt] = useState(0);
  const [loanDiscovery, setLoanDiscovery] = useState<{ wallet: string; loading: boolean; error: string | null }>({ wallet: '', loading: false, error: null });
  const [loanDiscoveryAttempt, setLoanDiscoveryAttempt] = useState(0);
  const protocol = useRead(contracts ? 'protocol' : null, getV2ProtocolState);
  const pending = useRead(contracts && wallet && validId(depositId) ? `${wallet}:deposit:${depositId}` : null, () => getV2PendingDeposit(depositId));
  const directLoan = useRead(contracts && wallet && validId(loanId) ? `${wallet}:direct:${loanId}` : null, () => getV2Loan(loanId));
  const peerLoan = useRead(contracts && wallet && validId(p2pLoanId) ? `${wallet}:p2p:${p2pLoanId}` : null, () => getV2Loan(p2pLoanId));
  const request = useRead(contracts && wallet && validId(requestId) ? `${wallet}:request:${requestId}` : null, () => getV2Request(requestId));
  const history = useRead(contracts && wallet ? `${wallet}:history` : null, () => getV2WalletHistory(wallet));
  const p2pCapacity = useRead(contracts && wallet && positiveAmount(p2pCollateral) ? `${wallet}:p2p-capacity:${p2pCollateral}` : null, () => getV2P2PRequestCapacity(p2pCollateral));
  const deposit = pending.data;
  const loan = directLoan.data?.isDirect ? directLoan.data : null;
  const p2pLoan = peerLoan.data && !peerLoan.data.isDirect ? peerLoan.data : null;
  const busy = operation !== null;
  const canWrite = !!wallet && isCorrectNetwork && !busy;
  const actions = loanActions(loan, wallet);
  const peerActions = loanActions(p2pLoan, wallet);

  useEffect(() => {
    setSelection(emptySelection(wallet)); setDepositReceipt(null); setTransaction(null);
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

  const refresh = async () => {
    await Promise.allSettled([protocol.reload(), pending.reload(), directLoan.reload(), peerLoan.reload(), request.reload(), history.reload(), refreshBalances()]);
  };
  const execute = async (scope: Scope, name: string, send: (progress: V2ProgressListener) => Promise<V2Tx>) => {
    if (inFlight.current) return;
    if (!wallet || !isCorrectNetwork) {
      setTransaction({ action: name, error: !wallet ? 'Connect MetaMask first.' : 'Switch MetaMask to Hardhat Local (31337).' }); return;
    }
    const submittingWallet = wallet;
    inFlight.current = true; setOperation({ scope, name }); setTransaction({ action: name });
    let tx: V2Tx;
    try {
      tx = await send(progress => { if (walletRef.current === submittingWallet) setTransaction({ action: name, progress }); });
    } catch (error) {
      if (walletRef.current === submittingWallet) setTransaction(previous => ({ ...previous, action: name, error: lendingV2ErrorMessage(error) }));
      inFlight.current = false; setOperation(null); return;
    }
    // Receipt success is final even if subsequent RPC/indexer refresh fails.
    if (walletRef.current === submittingWallet) {
      setTransaction({ action: name, result: tx });
      setSelection(previous => {
        const value = previous.wallet === submittingWallet ? previous : emptySelection(submittingWallet);
        if (scope === 'direct') return { ...value, depositId: name === 'Borrow' ? '' : tx.depositId || value.depositId, loanId: tx.loanId || value.loanId };
        return { ...value, requestId: tx.requestId || value.requestId, p2pLoanId: tx.loanId || value.p2pLoanId };
      });
      if (name === 'Collateral deposit') setDepositReceipt(tx);
      // Verify the affected objects, including the vault after withdrawal.
      const reads: Promise<unknown>[] = [refreshBalances(), protocol.reload(), history.reload()];
      if (tx.depositId) reads.push(getV2PendingDeposit(tx.depositId));
      if (tx.loanId) reads.push(getV2Loan(tx.loanId));
      if (scope === 'direct' && validId(loanId)) reads.push(directLoan.reload());
      if (scope === 'direct' && validId(depositId)) reads.push(pending.reload());
      if (scope === 'p2p' && validId(requestId)) reads.push(request.reload());
      if (scope === 'p2p' && validId(p2pLoanId)) reads.push(peerLoan.reload());
      const results = await Promise.allSettled(reads);
      const failed = results.find(result => result.status === 'rejected') as PromiseRejectedResult | undefined;
      if (failed && walletRef.current === submittingWallet) setTransaction({ action: name, result: tx, refreshWarning: lendingV2ErrorMessage(failed.reason) });
    }
    inFlight.current = false; setOperation(null);
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
  const requestReady = request.data && request.data.requestId === requestId;
  const currentRequest = requestReady ? request.data : null;
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
    <LendingReferralPanel wallet={wallet} canWrite={canWrite} />
    <div role="tablist" aria-label="Lending workflow" className="flex gap-2 rounded-xl bg-slate-900 p-2">
      <button role="tab" aria-selected={tab === 'direct'} onClick={() => setTab('direct')} className={tab === 'direct' ? primary : secondary}>Direct Lending</button>
      <button role="tab" aria-selected={tab === 'p2p'} onClick={() => setTab('p2p')} className={tab === 'p2p' ? primary : secondary}>P2P Lending</button>
    </div>
    {tab === 'direct' && <section role="tabpanel" aria-label="Lending V2 direct lending flow" className="space-y-5">
      <p role="status" className="text-sm capitalize text-cyan-200">Current step: {stageText}</p>
      <Card title="1. Deposit Collateral">
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
      <Card title="Loan Status">
        <LoanSelector value={loanId} onChange={value => select('loanId', value)} records={knownLoans.filter(record => sameWallet((record.loan as Record<string, unknown> | undefined)?.lender as string, contracts.pool))} />
        {loanDiscovery.wallet === wallet && loanDiscovery.loading && !loanId && <p role="status">Finding your current direct loans from canonical V2 events…</p>}
        {loanDiscovery.wallet === wallet && loanDiscovery.error && <ReadError error={loanDiscovery.error} retry={() => setLoanDiscoveryAttempt(value => value + 1)} />}
        <ReadError error={directLoan.error} retry={() => void directLoan.reload().catch(() => {})} />
        {directLoan.loading && <p role="status">Reading loan state…</p>}
        {directLoan.data && !directLoan.data.isDirect && <Empty>This is a P2P loan. Open it under P2P Lending.</Empty>}
        {loan ? <LoanStatus loan={loan} loanId={loanId} wallet={wallet} /> : <Empty>No direct loan selected. A confirmed borrow creates your Loan ID automatically.</Empty>}
      </Card>
      <Card title="3. Repay ABCD">
        {actions.repay ? <><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Current outstanding debt" value={`${loan!.outstanding} ABCD`} /><Metric label="Accrued interest" value={`${loan!.accruedInterest} ABCD`} /></Metrics>{loan!.state === 7 ? <p className="text-sm text-amber-100">Residual debt remains payable. It was recorded after the approved collateral/recovery waterfall and does not create completion certificates; collateral cannot be withdrawn while debt remains.</p> : loan!.schedule && <><Metrics><Metric label="Next Direct installment" value={`${loan!.schedule.installmentAmount} ABCD`} /><Metric label="Recovery state" value={loan!.schedule.state} /><Metric label="Amount applied" value={`${loan!.schedule.amountApplied} ABCD`} /><Metric label="Remaining scheduled due" value={`${loan!.schedule.remainingDue} ABCD`} /><Metric label="Installments paid" value={`${loan!.schedule.paidInstallments} / ${loan!.schedule.installmentCount}`} /><Metric label="Next due" value={timestamp(loan!.schedule.nextDueAt)} /></Metrics>{!loan!.schedule.completed && !loan!.schedule.due && <p role="status" className="text-sm text-amber-200">The next Direct installment is not due yet. Eligibility is read from the canonical chain block timestamp.</p>}<button className={primary} disabled={!canWrite || loan!.schedule.completed || !loan!.schedule.due || completionBusy} onClick={() => void execute('direct', 'Direct installment payment', progress => payV2DirectInstallment(loanId, prepareCompletionMetadata, progress))}>Approve ABCD & pay next installment</button></>}<Field label="Partial ABCD amount" inputMode="decimal" value={repayment} onChange={setRepayment} /><CompletionSettlementNotice busy={completionBusy} message={completionMessage} metadata={publishedCompletionMetadata} /><div className="flex flex-wrap gap-3"><button className={primary} disabled={!canWrite || !withinCapacity(repayment, loan!.outstanding) || sameAmount(repayment, loan!.outstanding)} onClick={() => void execute('direct', 'Partial repayment', progress => repayV2(loanId, repayment, progress))}>Repay partial</button><button className={secondary} disabled={!canWrite || completionBusy} onClick={() => void execute('direct', 'Full repayment', progress => repayAllV2(loanId, prepareCompletionMetadata, progress))}>{loan!.state === 7 ? 'Repay all residual debt' : 'Repay all & create certificates'}</button></div></> : <Empty>{!loan ? 'Repayment becomes available after a loan is created.' : 'Repayment is unavailable for this wallet or the current loan state.'}</Empty>}
      </Card>
      <Card title="4. Add collateral / cure">
        {loan?.state === 6 && <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100"><p className="font-bold">Margin Call Active</p><p>{p ? Number(p.marginCallCureSeconds) / 3600 : 'Unavailable'}-hour cure period</p><p>Deadline: {timestamp(loan.marginCallCureEnd)}</p><p className="mt-2 text-sm">Repay to cure or add collateral to cure. Refresh and sync risk state to confirm whether the margin call is cleared.</p></div>}
        {actions.topUp ? <><Metrics><Metric label="Original collateral" value={`${loan!.originalCollateralETH} ETH`} /><Metric label="Current vault collateral" value={`${loan!.currentVaultCollateralETH} ETH`} /><Metric label="Current debt" value={`${loan!.outstanding} ABCD`} /><Metric label="Current LTV" value={percent(loan!.ltvBps)} /><Metric label="Margin-call threshold" value={percent(p?.marginCallThresholdBps)} /><Metric label="Liquidation threshold" value={percent(p?.liquidationThresholdBps)} /></Metrics><Field label="Additional ETH collateral" inputMode="decimal" value={topUp} onChange={setTopUp} /><button className={primary} disabled={!canWrite || !positiveAmount(topUp)} onClick={() => void execute('direct', 'Loan collateral top-up', progress => addV2LoanCollateral(loanId, topUp, progress))}>{loan?.state === 6 ? 'Add collateral to cure' : 'Add collateral'}</button></> : <Empty>Collateral top-ups become available for an active loan owned by this wallet.</Empty>}
        {loan && [0, 2, 6].includes(loan.state) && <button className={secondary} disabled={!canWrite} onClick={() => void execute('direct', 'Risk-state synchronization', progress => syncV2LoanRisk(loanId, progress))}>Sync risk state</button>}
      </Card>
      <Card title="Due-installment collateral recovery">
        {loan?.schedule ? <><p className="text-sm text-slate-300">Any connected wallet may execute the approved recovery only after the exact on-chain due time. The contract validates the schedule, oracle snapshots, route, and remaining collateral; it never accepts a UI-provided amount.</p><Metrics><Metric label="Recovery state" value={loan.schedule.state} /><Metric label="Exact remaining due" value={`${loan.schedule.remainingDue} ABCD`} /><Metric label="Due time" value={timestamp(loan.schedule.nextDueAt)} /></Metrics><button className={secondary} disabled={!canWrite || loan.schedule.completed || !loan.schedule.due} onClick={() => void execute('direct', 'Due-installment collateral recovery', progress => executeV2OverdueEmi(loanId, progress))}>Execute due collateral recovery</button>{!loan.schedule.completed && !loan.schedule.due && <p role="status" className="text-sm text-amber-200">Recovery is unavailable until the canonical block timestamp reaches the stated due time.</p>}</> : <Empty>Load a loan with a canonical schedule to review its due-installment recovery state.</Empty>}
      </Card>
      <Card title="5. Withdraw Collateral">
        {actions.withdraw ? <><p className="font-bold text-emerald-200">Loan repaid ✓ — collateral available</p><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Current vault collateral available" value={`${loan!.currentVaultCollateralETH} ETH`} /><Metric label="Settlement state" value={stateLabel(loan!.state)} /></Metrics><button className={primary} disabled={!canWrite} onClick={() => void execute('direct', 'Collateral withdrawal', progress => withdrawV2Collateral(loanId, progress))}>Withdraw collateral</button></> : <Empty>{loan?.state === 5 && !positiveAmount(loan.currentVaultCollateralETH) ? 'Collateral withdrawn. The loan is closed.' : loan && positiveAmount(loan.outstanding) ? 'Collateral withdrawal is locked while debt remains.' : 'Collateral can be withdrawn after the loan is fully settled.'}</Empty>}
      </Card>
      {loan?.liquidatable && <Card title="Partial liquidation required"><p className="text-sm text-amber-200">This loan has reached the approximately 80% LTV risk threshold. The protocol derives the ceiling-rounded ETH sale amount from configured canonical feeds and targets 70% LTV.</p>{p?.partialLiquidationExecution === 'CONFIGURED' ? <><p className="mt-2 text-sm text-amber-100">Configured route: 1% minimum-output protection, lender-first recovery, borrower ABCD surplus return, and an atomic ≤70% target check. A normal partial liquidation never uses Reserve coverage or creates bad debt.</p><button className={secondary} disabled={!canWrite} onClick={() => void execute('direct', 'Partial liquidation', progress => liquidateV2(loanId, progress))}>Execute configured partial liquidation</button></> : <p className="mt-2 text-sm text-amber-100">Partial-liquidation execution is not configured: no collateral, debt, reserve, or LoanNFT state can be changed through this dashboard until canonical feed/router/route configuration is complete.</p>}</Card>}
    </section>}
    {tab === 'p2p' && <section role="tabpanel" aria-label="P2P Lending" className="space-y-5">
      <Card title="Create Request">
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
      <Card title="Fund Request"><div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]"><Field label="Request ID" value={requestId} onChange={value => { select('requestId', value); select('p2pLoanId', ''); }} inputMode="numeric" /><button type="button" aria-label="Load P2P request from LoanMarketplaceV2" className={secondary} disabled={!validId(requestId) || request.loading} onClick={loadP2PRequest}>{request.loading ? 'Loading request…' : 'Load request'}</button></div>{!validId(requestId) && <p className="text-sm text-slate-400">Enter an existing positive request ID to read its current canonical marketplace state.</p>}<ReadError error={request.error} retry={loadP2PRequest} />{request.loading && <p role="status">Reading request directly from LoanMarketplaceV2…</p>}{currentRequest ? <><Metrics><Metric label="Request" value={`#${requestId}`} /><Metric label="Principal" value={`${currentRequest.principal} ABCD`} /><Metric label="Collateral" value={`${currentRequest.collateralETH} ETH`} /><Metric label="Borrower" value={currentRequest.borrower} /><Metric label="Status" value={['Open', 'Funded', 'Cancelled', 'Settled'][currentRequest.state] || 'Unavailable'} /><Metric label="Lender" value={currentRequest.state === 0 ? 'Awaiting funding' : currentRequest.lender} /></Metrics><button className={primary} disabled={!canWrite || currentRequest.state !== 0 || sameWallet(currentRequest.borrower, wallet)} onClick={() => void execute('p2p', 'P2P funding', progress => fundV2Request(requestId, progress))}>Approve ABCD & fund request</button></> : <Empty>Enter a real request ID and select Load request to review it before funding.</Empty>}</Card>
      <Card title="Active Loan & EMI"><LoanSelector value={p2pLoanId} onChange={value => select('p2pLoanId', value)} records={knownLoans.filter(record => !sameWallet((record.loan as Record<string, unknown> | undefined)?.lender as string, contracts.pool))} /><ReadError error={peerLoan.error} retry={() => void peerLoan.reload().catch(() => {})} />{peerLoan.loading && <p role="status">Reading P2P loan…</p>}{peerLoan.data?.isDirect && <Empty>This is a direct loan. Use Direct Lending.</Empty>}{p2pLoan ? <><LoanStatus loan={p2pLoan} loanId={p2pLoanId} wallet={wallet} />{p2pLoan.state === 6 && sameWallet(p2pLoan.borrower, wallet) && <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"><p className="font-bold text-amber-100">P2P Margin Call Active</p><p className="text-sm text-amber-100">Add ETH collateral before {timestamp(p2pLoan.marginCallCureEnd)} to cure the position. The canonical pool/vault applies the top-up to this exact P2P loan ID.</p><Field label="Additional P2P ETH collateral" inputMode="decimal" value={p2pTopUp} onChange={setP2pTopUp} /><button className={primary} disabled={!canWrite || !peerActions.topUp || !positiveAmount(p2pTopUp)} onClick={() => void execute('p2p', 'P2P loan collateral top-up', progress => addV2LoanCollateral(p2pLoanId, p2pTopUp, progress))}>Add P2P collateral to cure</button><button className={secondary} disabled={!canWrite} onClick={() => void execute('p2p', 'P2P risk-state synchronization', progress => syncV2LoanRisk(p2pLoanId, progress))}>Sync P2P risk state</button></div>}{p2pLoan.schedule ? <><Metrics><Metric label="Next EMI" value={`${p2pLoan.schedule.installmentAmount} ABCD`} /><Metric label="Recovery state" value={p2pLoan.schedule.state} /><Metric label="Amount applied" value={`${p2pLoan.schedule.amountApplied} ABCD`} /><Metric label="Remaining scheduled due" value={`${p2pLoan.schedule.remainingDue} ABCD`} /><Metric label="Installments paid" value={`${p2pLoan.schedule.paidInstallments} / ${p2pLoan.schedule.installmentCount}`} /><Metric label="Next due" value={timestamp(p2pLoan.schedule.nextDueAt)} /></Metrics>{!p2pLoan.schedule.completed && !p2pLoan.schedule.due && <p role="status" className="text-sm text-amber-200">The next EMI is not due yet. Eligibility is read from the canonical chain block timestamp.</p>}{sameWallet(p2pLoan.borrower, wallet) && <CompletionSettlementNotice busy={completionBusy} message={completionMessage} metadata={publishedCompletionMetadata} />}<button className={primary} disabled={!canWrite || !peerActions.repay || p2pLoan.schedule.completed || !p2pLoan.schedule.due || completionBusy} onClick={() => void execute('p2p', 'EMI payment', progress => payV2Emi(p2pLoanId, prepareCompletionMetadata, progress))}>Approve ABCD & pay next EMI</button></> : <Empty>No EMI schedule is available for this loan.</Empty>}</> : <Empty>A funded P2P request creates a loan and its EMI schedule.</Empty>}</Card>
      <Card title="Settlement & Default Recovery">{p2pLoan ? <><Field label="Outstanding ABCD payment" value={p2pPayment} onChange={setP2pPayment} inputMode="decimal" /><button className={secondary} disabled={!canWrite || !peerActions.repay || !withinCapacity(p2pPayment, p2pLoan.outstanding) || completionBusy} onClick={() => void execute('p2p', 'Outstanding EMI repayment', progress => payV2OutstandingEmi(p2pLoanId, p2pPayment, prepareCompletionMetadata, progress))}>Approve ABCD & settle outstanding</button><p className="text-sm text-slate-300">Borrower-initiated repayment remains available through the canonical EMI and marketplace contracts.</p>{p2pLoan.schedule && <button className={secondary} disabled={!canWrite || p2pLoan.schedule.completed || !p2pLoan.schedule.due} onClick={() => void execute('p2p', 'Due-installment collateral recovery', progress => executeV2OverdueEmi(p2pLoanId, progress))}>Execute due collateral recovery</button>}<div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3"><p className="text-sm text-amber-100">Approved boundary: a due P2P installment can use its exact canonical collateral-recovery route and records DUE → PARTIALLY_SETTLED → SETTLED evidence. P2P partial liquidation, reserve/bad-debt settlement, and terminal default recovery remain fail-closed and out of scope.</p></div></> : <Empty>Load a funded request and loan to review borrower repayment and the P2P settlement-policy boundary.</Empty>}</Card>
    </section>}
    <Card title="Your positions & history">
      <ReadError error={history.error} retry={() => void history.reload().catch(() => {})} />
      {history.loading && <p role="status">Loading confirmed wallet history…</p>}
      {history.data ? <><Metrics><Metric label="Direct positions" value={String(history.data.directPositions.length)} /><Metric label="Loans" value={String(history.data.loans.length)} /><Metric label="Indexed events" value={String(history.data.events.length)} /></Metrics><div className="flex flex-wrap gap-2">{history.data.directPositions.filter(value => value.active).map(value => <button key={value.depositId} className={secondary} onClick={() => { select('depositId', value.depositId); setTab('direct'); }}>Deposit #{value.depositId}</button>)}{history.data.requests.map(value => <button key={value.requestId} className={secondary} onClick={() => { select('requestId', value.requestId); setTab('p2p'); }}>Request #{value.requestId}</button>)}</div><details><summary className="cursor-pointer text-sm text-cyan-200">Confirmed events</summary><ul className="mt-3 space-y-2 text-xs text-slate-300">{history.data.events.map((event, index) => <li key={String(event._id || index)} className="break-all">{String(event.eventName || 'Event')} — block {String(event.blockNumber ?? 'Unavailable')} — {String(event.transactionHash || 'Transaction unavailable')}</li>)}</ul></details></> : !history.loading && !history.error && <Empty>Connect a wallet to read confirmed history.</Empty>}
    </Card>
    <details className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <summary className="cursor-pointer font-semibold text-slate-200">Advanced Protocol Details</summary>
      <div className="mt-4 space-y-4"><p className="text-sm text-amber-200">Local Hardhat only — chain 31337. Oracle feeds are local mocks and are not production prices.</p><ReadError error={protocol.error} retry={() => void protocol.reload().catch(() => {})} />
        {p && <Metrics><Metric label="Direct initial LTV" value={percent(p.initialLtvBps)} /><Metric label="Direct new-loan APR" value={percent(p.aprBps)} /><Metric label="P2P ETH initial LTV" value={percent(p.p2pInitialLtvBps)} /><Metric label="P2P ETH APR" value={percent(p.p2pAprBps)} /><Metric label="Margin-call threshold" value={percent(p.marginCallThresholdBps)} /><Metric label="Cure period" value={`${Number(p.marginCallCureSeconds) / 3600} hours`} /><Metric label="Partial-liquidation threshold" value={percent(p.liquidationThresholdBps)} /><Metric label="Restoration target" value={percent(p.partialLiquidationTargetLtvBps)} /><Metric label="Partial-sale execution" value={p.partialLiquidationExecution === 'CONFIGURED' ? 'Configured — local test-only; not production policy' : 'Not configured — fail closed'} /><Metric label="Terms (deployment configuration)" value={p.supportedTermsDays?.join(' / ') || 'Unavailable'} /><Metric label="Maturity grace (deployment configuration)" value={p.gracePeriodDays ? `${p.gracePeriodDays} days` : 'Unavailable'} /><Metric label="Pool liquidity" value={`${p.poolLiquidity} ABCD`} /><Metric label="Pool balance" value={`${p.poolTokenBalance} ABCD`} /><Metric label="Insurance reserve" value={`${p.reserveBalance} ABCD`} /><Metric label="Local oracle prices" value={`ETH $ ${p.ethUsd}; ABCD $ ${p.abcdUsd}`} /></Metrics>}
        <p className="text-xs text-slate-400">V2 deployment block: {getLendingV2DeploymentBlock() ?? 'Unavailable'}. Source: canonical lendingV2 manifest and isolated V2 event projection.</p><dl className="space-y-2">{Object.entries(contracts).map(([name, value]) => <div key={name} className="text-xs"><dt className="text-slate-400">{name}</dt><dd className="break-all font-mono text-slate-200">{value}</dd></div>)}</dl>
      </div>
    </details>
  </section>;
};

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
    <p className="text-sm text-slate-300">This is the canonical LendingReferralManagerV2, separate from legacy ICO referrals. It accrues 0.05% monthly accounting periods and permits one aggregate payout only after a successful loan completion or the contract’s one-year boundary.</p>
    <Metrics><Metric label="Lending referral contract" value={snapshot?.address || 'Reading'} /><Metric label="Monthly accrual basis" value={snapshot ? `${Number(snapshot.monthlyRewardBps) / 100}%` : 'Reading'} /><Metric label="Reward vault" value={snapshot?.rewardVault || 'Reading'} /><Metric label="Bound referrer" value={snapshot?.referrer || 'None'} /></Metrics>
    {snapshot?.code ? <Metric label="Your on-chain lending code" value={snapshot.code} /> : <div className="grid items-end gap-3 sm:grid-cols-2"><Field label="Create lending referral code" value={code} onChange={setCode} /><button className={secondary} disabled={!canWrite || busy || code.trim().length < 4} onClick={() => void run(() => createLendingReferralCode(code))}>Create lending code</button></div>}
    {!snapshot?.referrer && <div className="grid items-end gap-3 sm:grid-cols-2"><Field label="Bind an existing lending referral code" value={bindCode} onChange={setBindCode} /><button className={secondary} disabled={!canWrite || busy || !bindCode.trim()} onClick={() => void run(() => bindLendingReferrer(bindCode))}>Bind lending referrer</button></div>}
    <div className="grid items-end gap-3 sm:grid-cols-3"><Field label="Completed loan ID for aggregate payout" inputMode="numeric" value={claimLoanId} onChange={setClaimLoanId} /><Field label="Referred borrower/lender wallet" value={referred} onChange={setReferred} /><button className={secondary} disabled={!canWrite || busy || !validId(claimLoanId) || !/^0x[a-fA-F0-9]{40}$/.test(referred)} onClick={() => void run(() => claimLendingAccruedReward(claimLoanId, referred))}>Claim aggregate lending reward</button></div>
    {record && <Metrics><Metric label="Registered for this loan" value={record.registered ? 'Yes' : 'No'} /><Metric label="Accrued periods already paid" value={record.paidPeriods} /><Metric label="Aggregate rewards paid" value={`${record.totalRewards} ABCD`} /><Metric label="Monthly entitlement" value={`${record.monthlyReward} ABCD`} /></Metrics>}
    {tx && <p className="break-all text-xs text-emerald-200">Referral transaction: {tx.hash} (block {tx.blockNumber})</p>}{message && <p role="status" className="text-sm text-cyan-200">{message}</p>}
  </Card>;
}
function CompletionSettlementNotice({ busy, message, metadata }: { busy: boolean; message: string | null; metadata: PublishedCompletionMetadata | null }) {
  return <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"><h4 className="font-semibold text-violet-100">Completion LoanNFT certificates</h4><p className="text-xs text-slate-300">On a full settlement, the authenticated ABCDeFi platform prepares three genuine public-IPFS provenance records from canonical loan state, then the same settlement transaction mints the lender, borrower, and platform certificates. No borrower artwork, manual URI, or manual hash is accepted.</p>{busy && <p role="status" className="text-xs text-cyan-200">Preparing completion records…</p>}{message && <p role="status" className="break-all text-xs text-cyan-200">{message}</p>}{metadata && <Metrics><Metric label="Lender metadata URI" value={metadata.lender.metadataUri} /><Metric label="Borrower metadata URI" value={metadata.borrower.metadataUri} /><Metric label="Platform metadata URI" value={metadata.platform.metadataUri} /></Metrics>}</div>;
}
function LoanSelector({ value, onChange, records }: { value: string; onChange: (v: string) => void; records: Array<Record<string, unknown>> }) {
  return <div className="space-y-3"><Field label="Loan ID" inputMode="numeric" value={value} onChange={onChange} /><div className="flex flex-wrap gap-2">{records.filter(record => validId(String(record.loanId))).map(record => <button key={String(record.loanId)} className={secondary} onClick={() => onChange(String(record.loanId))}>Load loan #{String(record.loanId)}</button>)}</div></div>;
}
function LoanStatus({ loan, loanId, wallet }: { loan: V2Read; loanId: string; wallet: string }) {
  return <div className="space-y-4"><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Status" value={stateLabel(loan.state)} /><Metric label="Principal" value={`${loan.principal} ABCD`} /><Metric label="Original collateral" value={`${loan.originalCollateralETH} ETH`} /><Metric label="Current vault collateral" value={`${loan.currentVaultCollateralETH} ETH`} /><Metric label="Current debt" value={`${loan.outstanding} ABCD`} /><Metric label="Accrued interest" value={`${loan.accruedInterest} ABCD`} /><Metric label="Agreed APR" value={percent(loan.aprBps)} /><Metric label="Maturity" value={timestamp(loan.maturity)} /><Metric label="Current LTV" value={positiveAmount(loan.currentVaultCollateralETH) ? percent(loan.ltvBps) : 'No remaining collateral'} /><Metric label="Margin call" value={loan.state === 6 ? 'Active' : 'Not active'} /><Metric label="Margin-call deadline" value={loan.state === 6 || loan.state === 3 ? timestamp(loan.marginCallCureEnd) : 'Not applicable'} /><Metric label="Partial liquidation" value={loan.liquidatable === null ? 'Unavailable — refresh risk reads' : loan.liquidatable ? 'Required — see configured route status below' : 'Not required'} /></Metrics>
    {loan.riskError && <p role="alert" className="text-sm text-amber-200">Risk/oracle data unavailable: {loan.riskError}. Debt and collateral above remain contract reads.</p>}
    {loan.certificates.filter(certificate => sameWallet(certificate.owner, wallet)).length ? <details><summary className="cursor-pointer text-sm text-cyan-200">Your completed LoanNFT certificates</summary>{loan.certificates.filter(certificate => sameWallet(certificate.owner, wallet)).map(certificate => <Metrics key={certificate.tokenId}><Metric label="Certificate role" value={certificate.role} /><Metric label="Token ID" value={certificate.tokenId} /><Metric label="Owner" value={certificate.owner} /><Metric label="Loan association" value={certificate.loanId} /><Metric label="Metadata URI" value={certificate.uri || 'Unavailable'} /><Metric label="Metadata hash" value={certificate.hash || 'Unavailable'} /><Metric label="Informational 1% USD valuation" value={`${certificate.valuation} USD`} /><Metric label="Valuation feed" value={certificate.valuationFeed} /><Metric label="Valuation round" value={certificate.valuationRoundId} /><Metric label="Valuation updated" value={timestamp(certificate.valuationUpdatedAt)} /><Metric label="ABCD/USD snapshot" value={`${certificate.completionABCDUSDPrice} USD`} /><Metric label="Formula version" value={certificate.formulaVersion} /><Metric label="Completion time" value={timestamp(certificate.completedAt)} /><Metric label="Completion block" value={certificate.completionBlock} /></Metrics>)}</details> : <Empty>No completed certificate is owned by this wallet for this loan.</Empty>}
    <details><summary className="cursor-pointer text-sm text-slate-400">Advanced / Contract Details</summary><Metrics><Metric label="Borrower" value={loan.borrower} /><Metric label="Lender" value={loan.lender} /><Metric label="Health factor (contract raw value)" value={loan.healthFactor ?? 'Unavailable'} /><Metric label="Contractual total at maturity (not current payoff)" value={`${loan.totalRepayment} ABCD`} /><Metric label="Loan start" value={timestamp(loan.start)} /></Metrics></details>
  </div>;
}
