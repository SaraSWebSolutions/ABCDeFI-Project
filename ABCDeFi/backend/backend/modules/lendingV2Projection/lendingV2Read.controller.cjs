const { Contract, JsonRpcProvider, getAddress, isAddress } = require('ethers');
const { SCOPE } = require('./indexer.cjs');
const UINT = /^\d+$/;
const lower = (value) => value.toLowerCase();
const normalizeWallet = (value) => typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null;
const toJson = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(toJson) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)])) : value;
const boundedLimit = (value, fallback = 50) => Math.min(100, Math.max(1, Number.isInteger(Number(value)) ? Number(value) : fallback));
const loanJson = (loan, currentVaultCollateralETH) => toJson({
  borrower: loan.borrower,
  lender: loan.lender,
  // `collateralETH` remains the immutable LoanManager value for compatibility
  // and historical provenance. Consumers needing a current balance must use
  // `currentVaultCollateralETH`, which is read from CollateralVaultV2.
  collateralETH: loan.collateralETH,
  originalCollateralETH: loan.collateralETH,
  currentVaultCollateralETH,
  principal: loan.principal,
  principalOutstanding: loan.principalOutstanding,
  accruedInterest: loan.accruedInterest,
  fees: loan.fees,
  aprBps: loan.aprBps,
  start: loan.start,
  lastAccrual: loan.lastAccrual,
  maturity: loan.maturity,
  graceEnd: loan.graceEnd,
  marginCallAt: loan.marginCallAt,
  marginCallCureEnd: loan.marginCallCureEnd,
  state: loan.state,
  reserveContribution: loan.reserveContribution,
  badDebt: loan.badDebt,
  totalRepaid: loan.totalRepaid,
  isP2P: loan.isP2P,
});
const requestJson = (request) => toJson({ borrower: request.borrower, principal: request.principal, collateral: request.collateral, term: request.term, state: request.state, lender: request.lender, loanId: request.loanId, initialLtvBps: request.initialLtvBps });
const certificateJson = (certificate) => toJson({ loanId: certificate.loanId, requestId: certificate.requestId, borrower: certificate.borrower, lender: certificate.lender, platform: certificate.platform, principal: certificate.principal, collateral: certificate.collateral, agreedInterest: certificate.agreedInterest, totalScheduledRepayment: certificate.totalScheduledRepayment, actualRepayment: certificate.actualRepayment, certificateValue: certificate.certificateValue, aprBps: certificate.aprBps, start: certificate.start, maturity: certificate.maturity, completedAt: certificate.completedAt, completionBlock: certificate.completionBlock, status: certificate.status, role: certificate.role, isP2P: certificate.isP2P, metadataHash: certificate.metadataHash, valuationFeed: certificate.valuationFeed, valuationRoundId: certificate.valuationRoundId, valuationUpdatedAt: certificate.valuationUpdatedAt, completionABCDUSDPrice: certificate.completionABCDUSDPrice, formulaVersion: certificate.formulaVersion });
const scheduleJson = (schedule) => schedule.map((item) => toJson({ dueAt: item.dueAt, amount: item.amount, paid: item.paid, amountApplied: item.amountApplied, remainingDue: item.amount - item.amountApplied, state: item.state }));
const eventTuple = (event) => [BigInt(event.blockNumber), Number(event.transactionIndex), Number(event.logIndex)];
const compareEvents = (left, right) => {
  const [leftBlock, leftTransaction, leftLog] = eventTuple(left); const [rightBlock, rightTransaction, rightLog] = eventTuple(right);
  return leftBlock < rightBlock ? -1 : leftBlock > rightBlock ? 1 : leftTransaction - rightTransaction || leftLog - rightLog;
};
const encodeCursor = (event, deploymentVersion) => Buffer.from(JSON.stringify({ deploymentVersion, blockNumber: String(event.blockNumber), transactionIndex: Number(event.transactionIndex), logIndex: Number(event.logIndex) })).toString('base64url');
const decodeCursor = (value, deploymentVersion) => {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (cursor.deploymentVersion !== deploymentVersion || !UINT.test(String(cursor.blockNumber)) || !Number.isSafeInteger(cursor.transactionIndex) || !Number.isSafeInteger(cursor.logIndex)) throw new Error('invalid cursor');
    return { blockNumber: BigInt(cursor.blockNumber), transactionIndex: cursor.transactionIndex, logIndex: cursor.logIndex };
  } catch (_) { throw new Error('History cursor is invalid for the canonical Lending V2 deployment.'); }
};
const afterCursor = (event, cursor) => !cursor || (() => {
  const [blockNumber, transactionIndex, logIndex] = eventTuple(event);
  return blockNumber > cursor.blockNumber || (blockNumber === cursor.blockNumber && (transactionIndex > cursor.transactionIndex || (transactionIndex === cursor.transactionIndex && logIndex > cursor.logIndex)));
})();

function createLendingV2ReadController({ manifest, artifacts, models, provider = new JsonRpcProvider(manifest.rpcUrl) }) {
  const pool = new Contract(manifest.contracts.LendingPoolV2.address, artifacts.LendingPoolV2.abi, provider);
  const vault = new Contract(manifest.contracts.CollateralVaultV2.address, artifacts.CollateralVaultV2.abi, provider);
  const manager = new Contract(manifest.contracts.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
  const marketplace = new Contract(manifest.contracts.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, provider);
  const liquidation = new Contract(manifest.contracts.LiquidationV2.address, artifacts.LiquidationV2.abi, provider);
  const reserve = new Contract(manifest.contracts.InsuranceReserveV2.address, artifacts.InsuranceReserveV2.abi, provider);
  const emi = new Contract(manifest.contracts.EMIManagerV2.address, artifacts.EMIManagerV2.abi, provider);
  const nft = new Contract(manifest.contracts.LoanNFTV2.address, artifacts.LoanNFTV2.abi, provider);
  // Lending referrals are an isolated V2 surface.  They are never inferred
  // from the legacy ICO ReferralManager or from off-chain user records.
  const referral = manifest.contracts.LendingReferralManagerV2
    ? new Contract(manifest.contracts.LendingReferralManagerV2.address, artifacts.LendingReferralManagerV2.abi, provider)
    : null;
  const source = () => ({ kind: 'canonical-v2-indexed-on-chain', chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, contracts: Object.fromEntries(Object.entries(manifest.contracts).map(([name, record]) => [name, record.address])) });
  const availability = async () => {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== Number(manifest.chainId)) return { available: false, status: 'UNAVAILABLE', reason: 'The canonical Lending V2 RPC is on the wrong chain.', checkpoint: null };
    for (const [name, contract] of Object.entries(manifest.contracts)) {
      if (await provider.getCode(contract.address) === '0x') return { available: false, status: 'UNAVAILABLE', reason: `Canonical ${name} bytecode is missing for this deployment.`, checkpoint: null };
    }
    const checkpoint = await models.V2BlockCheckpoint.findOne({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, scope: SCOPE }).lean();
    return checkpoint?.lastProcessedBlock ? { available: true, status: 'AVAILABLE', checkpoint: checkpoint.lastProcessedBlock } : { available: false, status: 'UNAVAILABLE', reason: 'The canonical Lending V2 indexer has not completed a confirmed sync for this deployment.', checkpoint: null };
  };
  const requireAvailable = async (res, data = []) => { const state = await availability(); if (!state.available) { res.json({ source: source(), ...state, data }); return null; } return state; };
  const readLoan = async (loanId) => {
    const record = await manager.getLoan(loanId);
    if (lower(record.borrower) === '0x0000000000000000000000000000000000000000') return null;
    const requestId = await marketplace.requestByLoanId(loanId);
    // Debt, state, and schedule remain authoritative even when a production
    // oracle correctly rejects a stale price. Do not let an unavailable risk
    // quote hide a real loan or block repayment/read reconciliation.
    const [accruedInterest, outstanding, totalRepayment, state, schedule, currentVaultCollateralETH] = await Promise.all([
      manager.previewAccruedInterest(loanId), manager.previewOutstanding(loanId), manager.previewTotalRepayment(loanId), manager.previewLoanStatus(loanId), emi.getSchedule(loanId), vault.loanCollateral(loanId),
    ]);
    let currentLtvBps = null; let healthFactor = null; let liquidatable = null; let riskError = null;
    // Terminal zero-debt loans have no risk position. Avoid exposing the
    // contract's divide-by-zero sentinel as a meaningful LTV to the dashboard.
    if (outstanding !== 0n) {
      try {
        [currentLtvBps, healthFactor, liquidatable] = await Promise.all([
          liquidation.currentLtvBps(loanId), liquidation.healthFactor(loanId), liquidation.isLiquidatable(loanId),
        ]);
      } catch (error) {
        riskError = error?.shortMessage || error?.reason || error?.message || 'Canonical risk/oracle read is unavailable.';
      }
    }
    // Execution is enabled only when the deployed LiquidationV2 has a bound
    // adapter whose own immutable/configured route validates as live. This is
    // a read of canonical contracts, never a frontend quote or inference.
    let partialLiquidationExecution = 'NOT_CONFIGURED';
    if (!Boolean(record.isP2P)) {
      try {
        const saleAdapter = await liquidation.saleAdapter();
        if (lower(saleAdapter) !== '0x0000000000000000000000000000000000000000') {
          const adapter = new Contract(saleAdapter, ['function configured() view returns (bool)'], provider);
          if (await adapter.configured()) partialLiquidationExecution = 'CONFIGURED';
        }
      } catch (error) {
        riskError = riskError || error?.shortMessage || error?.reason || error?.message || 'Canonical liquidation-adapter read is unavailable.';
      }
    }
    const roleNames = ['LENDER', 'BORROWER', 'PLATFORM'];
    const certificateIds = await Promise.all([0, 1, 2].map((role) => nft.loanCertificates(loanId, role)));
    const certificates = (await Promise.all(certificateIds.map(async (certificateTokenId, role) => {
      if (certificateTokenId === 0n) return null;
      const [owner, tokenURI, certificate] = await Promise.all([nft.ownerOf(certificateTokenId), nft.tokenURI(certificateTokenId), nft.getCertificate(certificateTokenId)]);
      return { role: roleNames[role], tokenId: certificateTokenId, owner, tokenURI, certificate: certificateJson(certificate) };
    }))).filter(Boolean);
    const borrowerCertificate = certificates.find((certificate) => certificate.role === 'BORROWER') || null;
    return toJson({ loan: loanJson(record, currentVaultCollateralETH), previews: { accruedInterest, outstanding, totalRepayment, state, currentLtvBps, healthFactor, liquidatable, riskError, partialLiquidationExecution }, schedule: scheduleJson(schedule), certificate: borrowerCertificate, certificates });
  };
  const includesWallet = (value, wallet) => typeof value === 'string'
    ? value.toLowerCase() === wallet
    : Array.isArray(value) ? value.some((item) => includesWallet(item, wallet))
      : value && typeof value === 'object' ? Object.values(value).some((item) => includesWallet(item, wallet)) : false;
  const eventList = async (filter, count) => (await models.V2ChainEvent.find({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, ...filter }).lean()).sort(compareEvents).slice(0, count);
  const eventPage = async (filter, limit, cursor, predicate = () => true) => {
    const all = (await eventList(filter, Number.MAX_SAFE_INTEGER)).filter(predicate).filter((event) => afterCursor(event, cursor));
    const data = all.slice(0, limit);
    return { data, nextCursor: all.length > data.length ? encodeCursor(data[data.length - 1], manifest.deploymentVersion) : null };
  };
  const readRequest = async (requestId) => {
    const request = await marketplace.requests(requestId);
    if (lower(request.borrower) === '0x0000000000000000000000000000000000000000') return null;
    return requestJson(request);
  };
  const referralStatus = (state, claimable) => {
    if (state === 3 || state === 4) return 'STOPPED';
    return claimable ? 'CLAIMABLE' : 'ACCRUING_OR_AWAITING_PAYOUT';
  };
  const readReferral = async (wallet) => {
    if (!referral) throw new Error('Canonical LendingReferralManagerV2 is not configured for this deployment.');
    const [code, referrer, rewardVault, monthlyRewardBps, maxRewardPeriods, rewardPeriod] = await Promise.all([
      referral.userReferralCode(wallet), referral.referrerOf(wallet), referral.rewardVault(), referral.MONTHLY_REWARD_BPS(), referral.MAX_REWARD_PERIODS(), referral.REWARD_PERIOD(),
    ]);
    const now = BigInt((await provider.getBlock('latest')).timestamp);
    const referralEvents = await eventList({ contractName: 'LendingReferralManagerV2' }, 1_000);
    const related = referralEvents.filter((event) => lower(event.args.referrer || '') === wallet || lower(event.args.referred || '') === wallet);
    const registrations = related.filter((event) => event.eventName === 'LendingReferralRegistered');
    const rows = await Promise.all(registrations.map(async (event) => {
      const loanId = String(event.args.loanId);
      const referred = lower(event.args.referred);
      const [record, loan, effectiveState] = await Promise.all([
        referral.getLoanReferral(loanId, referred), manager.getLoan(loanId), manager.previewLoanStatus(loanId),
      ]);
      const termPeriods = (() => {
        const periods = (BigInt(loan.maturity) - BigInt(loan.start)) / BigInt(rewardPeriod);
        return periods > BigInt(maxRewardPeriods) ? BigInt(maxRewardPeriods) : periods;
      })();
      const endAt = BigInt(record.completedAt) === 0n ? now : BigInt(record.completedAt);
      const elapsedPeriods = endAt > BigInt(loan.start) ? (endAt - BigInt(loan.start)) / BigInt(rewardPeriod) : 0n;
      const availablePeriods = elapsedPeriods < termPeriods ? elapsedPeriods : termPeriods;
      const stopped = Number(effectiveState) === 3 || Number(effectiveState) === 4;
      const completionPayout = Number(loan.state) === 5 && BigInt(record.completedAt) !== 0n;
      const oneYearPayout = now >= BigInt(record.startedAt) + 365n * 24n * 60n * 60n;
      const unpaidPeriods = availablePeriods > BigInt(record.paidPeriods) ? availablePeriods - BigInt(record.paidPeriods) : 0n;
      const claimable = !stopped && (completionPayout || oneYearPayout) && unpaidPeriods !== 0n;
      const certificateEvent = related.find((candidate) => candidate.eventName === 'LendingReferralCertificateMinted'
        && String(candidate.args.loanId) === loanId && lower(candidate.args.referred || '') === referred && lower(candidate.args.referrer || '') === lower(record.referrer));
      let certificate = null;
      if (certificateEvent) {
        const tokenId = certificateEvent.args.tokenId;
        const [stored, owner, uri] = await Promise.all([referral.getReferralCertificate(tokenId), referral.ownerOf(tokenId), referral.tokenURI(tokenId)]);
        certificate = toJson({ tokenId, owner, uri, loanId: stored.loanId, requestId: stored.requestId, referrer: stored.referrer, referred: stored.referred, value: stored.value, isLenderReferral: stored.isLenderReferral, metadataHash: stored.metadataHash, transferability: 'NON_TRANSFERABLE_BY_CURRENT_CONTRACT__WHITEPAPER_UNSPECIFIED' });
      }
      return toJson({
        loanId, requestId: record.requestId, referrer: record.referrer, referred: record.referred, isLenderReferral: record.isLenderReferral,
        registered: record.registered, startedAt: record.startedAt, completedAt: record.completedAt, monthlyReward: record.monthlyReward,
        paidPeriods: record.paidPeriods, totalRewards: record.totalRewards, availablePeriods, accruedAmount: BigInt(record.monthlyReward) * availablePeriods,
        claimableAmount: claimable ? BigInt(record.monthlyReward) * unpaidPeriods : 0n, claimable, status: referralStatus(Number(effectiveState), claimable), certificate,
      });
    }));
    return toJson({
      contract: await referral.getAddress(), code, referrer: lower(referrer) === '0x0000000000000000000000000000000000000000' ? null : referrer,
      rewardVault, monthlyRewardBps, maxRewardPeriods, rewardPeriodSeconds: rewardPeriod, records: rows,
      events: related,
    });
  };
  const walletState = async (wallet, limit) => {
    const events = (await eventList({}, 1_000)).filter((event) => includesWallet(event.args, wallet));
    const directDepositIds = [...new Set(events.filter((event) => event.eventName === 'CollateralDepositCreated' && lower(event.args.borrower) === wallet).map((event) => event.args.depositId).filter((id) => typeof id === 'string' && UINT.test(id)))];
    const directPositions = [];
    for (const depositId of directDepositIds) {
      const [pending, collateral] = await Promise.all([pool.pendingCollateral(depositId), vault.directDepositCollateral(depositId)]);
      const maxBorrowable = await pool.maxBorrowable(collateral);
      if (lower(pending.borrower) === wallet || collateral !== 0n) directPositions.push(toJson({ depositId, borrower: pending.borrower, active: pending.active, collateralETH: collateral, maxBorrowable }));
    }
    const requestIds = [...new Set(events.filter((event) => typeof event.args.requestId === 'string' && UINT.test(event.args.requestId)).map((event) => event.args.requestId))];
    const requests = [];
    for (const requestId of requestIds) {
      const request = await readRequest(requestId);
      if (request && (lower(request.borrower) === wallet || lower(request.lender) === wallet)) requests.push(toJson({ requestId, borrower: request.borrower, lender: request.lender, principal: request.principal, collateralETH: request.collateral, termSeconds: request.term, state: request.state, loanId: request.loanId, initialLtvBps: request.initialLtvBps }));
    }
    const candidateLoanIds = [...new Set(events.map((event) => event.args.loanId).filter((id) => typeof id === 'string' && UINT.test(id)))];
    const loans = [];
    for (const loanId of candidateLoanIds) {
      const loan = await readLoan(loanId);
      if (loan && (lower(loan.loan.borrower) === wallet || lower(loan.loan.lender) === wallet)) loans.push({ loanId, ...loan });
    }
    return { directPositions, requests, loans, events: events.slice(-limit) };
  };
  return {
    status: async (_req, res, next) => { try { res.json({ source: source(), ...(await availability()) }); } catch (error) { next(error); } },
    reserve: async (_req, res, next) => { try {
      const state = await requireAvailable(res, { balance: '0', fundingEvents: [], payoutEvents: [], accountingEvents: [] }); if (!state) return;
      const [balance, reserveCoverCapABCD, fundingEvents, payoutEvents, accountingEvents] = await Promise.all([
        reserve.availableBalance(),
        reserve.reserveCoverCapABCD(),
        eventList({ contractName: 'InsuranceReserveV2', eventName: 'ReserveFunded' }, 100),
        eventList({ contractName: 'InsuranceReserveV2', eventName: 'ReserveUsed' }, 100),
        eventList({ contractName: 'InsuranceReserveV2', eventName: 'ReserveBalanceUpdated' }, 100),
      ]);
      // The balance is read directly from InsuranceReserveV2. Events are an
      // indexed audit projection, never a source of financial authority.
      res.json({ source: source(), ...state, data: { balance: balance.toString(), reserveCoverCapABCD: reserveCoverCapABCD.toString(), fundingEvents, payoutEvents, accountingEvents } });
    } catch (error) { next(error); } },
    openRequests: async (req, res, next) => { try {
      const state = await requireAvailable(res); if (!state) return;
      const created = await eventList({ contractName: 'LoanMarketplaceV2', eventName: 'RequestCreated' }, boundedLimit(req.query.limit)); const data = [];
      for (const event of created) { const request = await marketplace.requests(event.args.requestId); if (Number(request.state) === 0) data.push({ requestId: event.args.requestId, request: toJson(request), createdEvidence: event }); }
      res.json({ source: source(), ...state, data });
    } catch (error) { next(error); } },
    wallet: async (req, res, next) => { try {
      const wallet = normalizeWallet(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be a valid Ethereum address.' });
      const state = await requireAvailable(res, { events: [], loanIds: [] }); if (!state) return;
      const data = await walletState(wallet, boundedLimit(req.query.limit));
      res.json({ source: source(), ...state, wallet, data });
    } catch (error) { next(error); } },
    loan: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res); if (state) { const data = await readLoan(id); if (!data) return res.status(404).json({ source: source(), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(), ...state, data }); } } catch (error) { next(error); } },
    history: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, []); if (state) { const page = await eventPage({}, boundedLimit(req.query.limit), decodeCursor(req.query.cursor, manifest.deploymentVersion), (event) => String(event.args.loanId || '') === id); res.json({ source: source(), ...state, data: page.data, page: { limit: boundedLimit(req.query.limit), nextCursor: page.nextCursor } }); } } catch (error) { if (/History cursor is invalid/.test(error.message)) return res.status(400).json({ status: 'INVALID_REQUEST', message: error.message }); next(error); } },
    preview: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res); if (state) { const data = await readLoan(id); if (!data) return res.status(404).json({ source: source(), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(), ...state, data: data.previews }); } } catch (error) { next(error); } },
    request: async (req, res, next) => { try { const id = req.params.requestId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Request ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res); if (state) { const data = await readRequest(id); if (!data) return res.status(404).json({ source: source(), ...state, status: 'NOT_FOUND', data: null }); const history = (await eventList({}, 1_000)).filter((event) => String(event.args.requestId || '') === id); res.json({ source: source(), ...state, data: { requestId: id, request: data, history } }); } } catch (error) { next(error); } },
    referral: async (req, res, next) => { try { const wallet = normalizeWallet(req.params.address); if (!wallet) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Wallet address must be a valid Ethereum address.' }); const state = await requireAvailable(res); if (state) res.json({ source: source(), ...state, data: await readReferral(wallet) }); } catch (error) { next(error); } },
  };
}
module.exports = { createLendingV2ReadController, loanJson, normalizeWallet };
