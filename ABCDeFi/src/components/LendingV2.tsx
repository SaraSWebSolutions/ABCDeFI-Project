import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatEther, parseEther } from 'ethers';
import { useWallet } from '../Context/WalletContext';
import { getLendingV2Contracts, getLendingV2DeploymentBlock } from '../Config/contracts';
import {
  addV2LoanCollateral, borrowV2, createV2Request, depositV2Collateral, fundV2Request,
  getV2LatestDirectLoanForWallet, getV2LatestPendingDepositForWallet, getV2Loan, getV2PendingDeposit, getV2ProtocolState,
  getV2P2PRequestCapacity, getV2Request, getV2WalletHistory, lendingV2ErrorMessage, liquidateV2,
  payV2Emi, payV2OutstandingEmi, repayAllV2, repayV2, settleV2Default, stateLabel,
  syncV2LoanRisk, withdrawV2Collateral,
  type CompletionCertificateMetadata, type V2PendingDeposit, type V2ProgressListener, type V2Read, type V2Tx,
} from '../Services/lendingV2';
import { borrowBlocker, directStage, loanActions, positiveAmount, sameAmount, sameWallet, validId, validTerm, withinCapacity } from '../Utils/lendingV2Flow';
import { prepareLoanCompletionMetadata, type PublishedCompletionMetadata } from '../Services/lendingV2Metadata';
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
        {actions.repay ? <><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Current outstanding debt" value={`${loan!.outstanding} ABCD`} /><Metric label="Accrued interest" value={`${loan!.accruedInterest} ABCD`} /><Metric label="Late fee" value={`${loan!.lateFee} ABCD`} /></Metrics><Field label="Partial ABCD amount" inputMode="decimal" value={repayment} onChange={setRepayment} /><CompletionSettlementNotice busy={completionBusy} message={completionMessage} metadata={publishedCompletionMetadata} /><div className="flex flex-wrap gap-3"><button className={primary} disabled={!canWrite || !withinCapacity(repayment, loan!.outstanding) || sameAmount(repayment, loan!.outstanding)} onClick={() => void execute('direct', 'Partial repayment', progress => repayV2(loanId, repayment, progress))}>Repay partial</button><button className={secondary} disabled={!canWrite || completionBusy} onClick={() => void execute('direct', 'Full repayment', progress => repayAllV2(loanId, prepareCompletionMetadata, progress))}>Repay all & create certificates</button></div></> : <Empty>{!loan ? 'Repayment becomes available after a loan is created.' : 'Repayment is unavailable for this wallet or the current loan state.'}</Empty>}
      </Card>
      <Card title="4. Add collateral / cure">
        {loan?.state === 6 && <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-amber-100"><p className="font-bold">Margin Call Active</p><p>{p ? Number(p.marginCallCureSeconds) / 3600 : 'Unavailable'}-hour cure period</p><p>Deadline: {timestamp(loan.marginCallCureEnd)}</p><p className="mt-2 text-sm">Repay to cure or add collateral to cure. Refresh and sync risk state to confirm whether the margin call is cleared.</p></div>}
        {actions.topUp ? <><Metrics><Metric label="Current collateral" value={`${loan!.collateralETH} ETH`} /><Metric label="Current debt" value={`${loan!.outstanding} ABCD`} /><Metric label="Current LTV" value={percent(loan!.ltvBps)} /><Metric label="Margin-call threshold" value={percent(p?.marginCallThresholdBps)} /><Metric label="Liquidation threshold" value={percent(p?.liquidationThresholdBps)} /></Metrics><Field label="Additional ETH collateral" inputMode="decimal" value={topUp} onChange={setTopUp} /><button className={primary} disabled={!canWrite || !positiveAmount(topUp)} onClick={() => void execute('direct', 'Loan collateral top-up', progress => addV2LoanCollateral(loanId, topUp, progress))}>{loan?.state === 6 ? 'Add collateral to cure' : 'Add collateral'}</button></> : <Empty>Collateral top-ups become available for an active loan owned by this wallet.</Empty>}
        {loan && [0, 2, 6].includes(loan.state) && <button className={secondary} disabled={!canWrite} onClick={() => void execute('direct', 'Risk-state synchronization', progress => syncV2LoanRisk(loanId, progress))}>Sync risk state</button>}
      </Card>
      <Card title="5. Withdraw Collateral">
        {actions.withdraw ? <><p className="font-bold text-emerald-200">Loan repaid ✓ — collateral available</p><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Collateral available" value={`${loan!.collateralETH} ETH`} /><Metric label="Settlement state" value={stateLabel(loan!.state)} /></Metrics><button className={primary} disabled={!canWrite} onClick={() => void execute('direct', 'Collateral withdrawal', progress => withdrawV2Collateral(loanId, progress))}>Withdraw collateral</button></> : <Empty>{loan?.state === 5 && !positiveAmount(loan.collateralETH) ? 'Collateral withdrawn. The loan is closed.' : loan && positiveAmount(loan.outstanding) ? 'Collateral withdrawal is locked while debt remains.' : 'Collateral can be withdrawn after the loan is fully settled.'}</Empty>}
      </Card>
      {loan?.liquidatable && <Card title="Liquidation eligible"><p className="text-sm text-amber-200">The contract reports that this loan is eligible for liquidation. Settlement is confirmed only after the transaction receipt.</p><button className={secondary} disabled={!canWrite} onClick={() => void execute('direct', 'Liquidation', progress => liquidateV2(loanId, progress))}>Approve ABCD & liquidate</button></Card>}
    </section>}
    {tab === 'p2p' && <section role="tabpanel" aria-label="P2P Lending" className="space-y-5">
      <Card title="Create Request">
        <p className="text-sm text-slate-300">Create an ETH-collateral-backed request for another wallet to fund. The marketplace contract independently prices collateral through the canonical oracle and enforces the ETH-specific 35% initial LTV policy.</p>
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
          <Metric label="Maximum P2P principal" value={`${p2pCapacity.data.maxPrincipal} ABCD`} />
          <Metric label="Remaining capacity" value={p2pRemainingCapacity === 'Unavailable' ? 'Enter a valid principal' : `${p2pRemainingCapacity} ABCD`} />
        </Metrics>}
        {positiveAmount(p2pPrincipal) && p2pCapacity.data && !p2pWithinCapacity && <p role="alert" className="text-sm text-amber-200">Requested principal exceeds the contract-authoritative P2P capacity.</p>}
        <CompletionLifecycleNotice />
        <button className={primary} disabled={!canWrite || !p2pWithinCapacity || !validTerm(p2pTerm)} onClick={() => void execute('p2p', 'P2P request', progress => createV2Request(p2pPrincipal, p2pCollateral, Number(p2pTerm), progress))}>Create P2P request</button>
      </Card>
      <Card title="Fund Request"><div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]"><Field label="Request ID" value={requestId} onChange={value => { select('requestId', value); select('p2pLoanId', ''); }} inputMode="numeric" /><button type="button" aria-label="Load P2P request from LoanMarketplaceV2" className={secondary} disabled={!validId(requestId) || request.loading} onClick={loadP2PRequest}>{request.loading ? 'Loading request…' : 'Load request'}</button></div>{!validId(requestId) && <p className="text-sm text-slate-400">Enter an existing positive request ID to read its current canonical marketplace state.</p>}<ReadError error={request.error} retry={loadP2PRequest} />{request.loading && <p role="status">Reading request directly from LoanMarketplaceV2…</p>}{currentRequest ? <><Metrics><Metric label="Request" value={`#${requestId}`} /><Metric label="Principal" value={`${currentRequest.principal} ABCD`} /><Metric label="Collateral" value={`${currentRequest.collateralETH} ETH`} /><Metric label="Borrower" value={currentRequest.borrower} /><Metric label="Status" value={['Open', 'Funded', 'Cancelled', 'Settled'][currentRequest.state] || 'Unavailable'} /><Metric label="Lender" value={currentRequest.state === 0 ? 'Awaiting funding' : currentRequest.lender} /></Metrics><button className={primary} disabled={!canWrite || currentRequest.state !== 0 || sameWallet(currentRequest.borrower, wallet)} onClick={() => void execute('p2p', 'P2P funding', progress => fundV2Request(requestId, progress))}>Approve ABCD & fund request</button></> : <Empty>Enter a real request ID and select Load request to review it before funding.</Empty>}</Card>
      <Card title="Active Loan & EMI"><LoanSelector value={p2pLoanId} onChange={value => select('p2pLoanId', value)} records={knownLoans.filter(record => !sameWallet((record.loan as Record<string, unknown> | undefined)?.lender as string, contracts.pool))} /><ReadError error={peerLoan.error} retry={() => void peerLoan.reload().catch(() => {})} />{peerLoan.loading && <p role="status">Reading P2P loan…</p>}{peerLoan.data?.isDirect && <Empty>This is a direct loan. Use Direct Lending.</Empty>}{p2pLoan ? <><LoanStatus loan={p2pLoan} loanId={p2pLoanId} wallet={wallet} />{p2pLoan.schedule ? <><Metrics><Metric label="Next EMI" value={`${p2pLoan.schedule.installmentAmount} ABCD`} /><Metric label="Installments paid" value={`${p2pLoan.schedule.paidInstallments} / ${p2pLoan.schedule.installmentCount}`} /><Metric label="Next due" value={timestamp(p2pLoan.schedule.nextDueAt)} /></Metrics>{sameWallet(p2pLoan.borrower, wallet) && <CompletionSettlementNotice busy={completionBusy} message={completionMessage} metadata={publishedCompletionMetadata} />}<button className={primary} disabled={!canWrite || !peerActions.repay || p2pLoan.schedule.completed || completionBusy} onClick={() => void execute('p2p', 'EMI payment', progress => payV2Emi(p2pLoanId, prepareCompletionMetadata, progress))}>Approve ABCD & pay next EMI</button></> : <Empty>No EMI schedule is available for this loan.</Empty>}</> : <Empty>A funded P2P request creates a loan and its EMI schedule.</Empty>}</Card>
      <Card title="Settlement & Default Recovery">{p2pLoan ? <><Field label="Outstanding ABCD payment" value={p2pPayment} onChange={setP2pPayment} inputMode="decimal" /><button className={secondary} disabled={!canWrite || !peerActions.repay || !withinCapacity(p2pPayment, p2pLoan.outstanding) || completionBusy} onClick={() => void execute('p2p', 'Outstanding EMI repayment', progress => payV2OutstandingEmi(p2pLoanId, p2pPayment, prepareCompletionMetadata, progress))}>Approve ABCD & settle outstanding</button><p className="text-sm text-slate-300">Collateral release and lender settlement follow the on-chain EMI and marketplace state.</p><button className={secondary} disabled={!canWrite || !currentRequest || currentRequest.state !== 1 || currentRequest.loanId !== p2pLoanId || p2pLoan.state !== 3} onClick={() => void execute('p2p', 'P2P default settlement', progress => settleV2Default(requestId, progress))}>Settle eligible default</button></> : <Empty>Load a funded request and loan to review settlement or default recovery.</Empty>}</Card>
    </section>}
    <Card title="Your positions & history">
      <ReadError error={history.error} retry={() => void history.reload().catch(() => {})} />
      {history.loading && <p role="status">Loading confirmed wallet history…</p>}
      {history.data ? <><Metrics><Metric label="Direct positions" value={String(history.data.directPositions.length)} /><Metric label="Loans" value={String(history.data.loans.length)} /><Metric label="Indexed events" value={String(history.data.events.length)} /></Metrics><div className="flex flex-wrap gap-2">{history.data.directPositions.filter(value => value.active).map(value => <button key={value.depositId} className={secondary} onClick={() => { select('depositId', value.depositId); setTab('direct'); }}>Deposit #{value.depositId}</button>)}{history.data.requests.map(value => <button key={value.requestId} className={secondary} onClick={() => { select('requestId', value.requestId); setTab('p2p'); }}>Request #{value.requestId}</button>)}</div><details><summary className="cursor-pointer text-sm text-cyan-200">Confirmed events</summary><ul className="mt-3 space-y-2 text-xs text-slate-300">{history.data.events.map((event, index) => <li key={String(event._id || index)} className="break-all">{String(event.eventName || 'Event')} — block {String(event.blockNumber ?? 'Unavailable')} — {String(event.transactionHash || 'Transaction unavailable')}</li>)}</ul></details></> : !history.loading && !history.error && <Empty>Connect a wallet to read confirmed history.</Empty>}
    </Card>
    <details className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
      <summary className="cursor-pointer font-semibold text-slate-200">Advanced Protocol Details</summary>
      <div className="mt-4 space-y-4"><p className="text-sm text-amber-200">Local Hardhat only — chain 31337. Oracle feeds are local mocks and are not production prices.</p><ReadError error={protocol.error} retry={() => void protocol.reload().catch(() => {})} />
        {p && <Metrics><Metric label="Initial LTV" value={percent(p.initialLtvBps)} /><Metric label="New-loan APR" value={percent(p.aprBps)} /><Metric label="Margin-call threshold" value={percent(p.marginCallThresholdBps)} /><Metric label="Cure period" value={`${Number(p.marginCallCureSeconds) / 3600} hours`} /><Metric label="Liquidation threshold" value={percent(p.liquidationThresholdBps)} /><Metric label="Close factor" value={percent(p.closeFactorBps)} /><Metric label="Liquidation bonus" value={percent(p.liquidationBonusBps)} /><Metric label="Late fee" value={percent(p.lateFeeBps)} /><Metric label="Terms (deployment configuration)" value={p.supportedTermsDays?.join(' / ') || 'Unavailable'} /><Metric label="Maturity grace (deployment configuration)" value={p.gracePeriodDays ? `${p.gracePeriodDays} days` : 'Unavailable'} /><Metric label="Pool liquidity" value={`${p.poolLiquidity} ABCD`} /><Metric label="Pool balance" value={`${p.poolTokenBalance} ABCD`} /><Metric label="Insurance reserve" value={`${p.reserveBalance} ABCD`} /><Metric label="Local oracle prices" value={`ETH $ ${p.ethUsd}; ABCD $ ${p.abcdUsd}`} /></Metrics>}
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
function CompletionSettlementNotice({ busy, message, metadata }: { busy: boolean; message: string | null; metadata: PublishedCompletionMetadata | null }) {
  return <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4"><h4 className="font-semibold text-violet-100">Completion LoanNFT certificates</h4><p className="text-xs text-slate-300">On a full settlement, the authenticated ABCDeFi platform prepares three genuine public-IPFS provenance records from canonical loan state, then the same settlement transaction mints the lender, borrower, and platform certificates. No borrower artwork, manual URI, or manual hash is accepted.</p>{busy && <p role="status" className="text-xs text-cyan-200">Preparing completion records…</p>}{message && <p role="status" className="break-all text-xs text-cyan-200">{message}</p>}{metadata && <Metrics><Metric label="Lender metadata URI" value={metadata.lender.metadataUri} /><Metric label="Borrower metadata URI" value={metadata.borrower.metadataUri} /><Metric label="Platform metadata URI" value={metadata.platform.metadataUri} /></Metrics>}</div>;
}
function LoanSelector({ value, onChange, records }: { value: string; onChange: (v: string) => void; records: Array<Record<string, unknown>> }) {
  return <div className="space-y-3"><Field label="Loan ID" inputMode="numeric" value={value} onChange={onChange} /><div className="flex flex-wrap gap-2">{records.filter(record => validId(String(record.loanId))).map(record => <button key={String(record.loanId)} className={secondary} onClick={() => onChange(String(record.loanId))}>Load loan #{String(record.loanId)}</button>)}</div></div>;
}
function LoanStatus({ loan, loanId, wallet }: { loan: V2Read; loanId: string; wallet: string }) {
  return <div className="space-y-4"><Metrics><Metric label="Loan ID" value={loanId} /><Metric label="Status" value={stateLabel(loan.state)} /><Metric label="Principal" value={`${loan.principal} ABCD`} /><Metric label="Remaining collateral (vault)" value={`${loan.collateralETH} ETH`} /><Metric label="Current debt including fees" value={`${loan.outstanding} ABCD`} /><Metric label="Accrued interest" value={`${loan.accruedInterest} ABCD`} /><Metric label="Late fee" value={`${loan.lateFee} ABCD`} /><Metric label="Agreed APR" value={percent(loan.aprBps)} /><Metric label="Maturity" value={timestamp(loan.maturity)} /><Metric label="Current LTV" value={positiveAmount(loan.collateralETH) ? percent(loan.ltvBps) : 'No remaining collateral'} /><Metric label="Margin call" value={loan.state === 6 ? 'Active' : 'Not active'} /><Metric label="Margin-call deadline" value={loan.state === 6 || loan.state === 3 ? timestamp(loan.marginCallCureEnd) : 'Not applicable'} /><Metric label="Liquidation eligibility" value={loan.liquidatable === null ? 'Unavailable — refresh risk reads' : loan.liquidatable ? 'Eligible' : 'Not eligible'} /></Metrics>
    {loan.riskError && <p role="alert" className="text-sm text-amber-200">Risk/oracle data unavailable: {loan.riskError}. Debt and collateral above remain contract reads.</p>}
    {loan.certificates.filter(certificate => sameWallet(certificate.owner, wallet)).length ? <details><summary className="cursor-pointer text-sm text-cyan-200">Your completed LoanNFT certificates</summary>{loan.certificates.filter(certificate => sameWallet(certificate.owner, wallet)).map(certificate => <Metrics key={certificate.tokenId}><Metric label="Certificate role" value={certificate.role} /><Metric label="Token ID" value={certificate.tokenId} /><Metric label="Owner" value={certificate.owner} /><Metric label="Loan association" value={certificate.loanId} /><Metric label="Metadata URI" value={certificate.uri || 'Unavailable'} /><Metric label="Metadata hash" value={certificate.hash || 'Unavailable'} /><Metric label="1% certificate valuation" value={`${certificate.valuation} ABCD accounting value`} /></Metrics>)}</details> : <Empty>No completed certificate is owned by this wallet for this loan.</Empty>}
    <details><summary className="cursor-pointer text-sm text-slate-400">Advanced / Contract Details</summary><Metrics><Metric label="Borrower" value={loan.borrower} /><Metric label="Lender" value={loan.lender} /><Metric label="Health factor (contract raw value)" value={loan.healthFactor ?? 'Unavailable'} /><Metric label="Contractual total at maturity (not current payoff)" value={`${loan.totalRepayment} ABCD`} /><Metric label="Loan start" value={timestamp(loan.start)} /></Metrics></details>
  </div>;
}
