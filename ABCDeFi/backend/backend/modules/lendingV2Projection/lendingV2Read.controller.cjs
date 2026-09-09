const { Contract, JsonRpcProvider, getAddress, isAddress } = require('ethers');
const { SCOPE } = require('./indexer.cjs');
const UINT = /^\d+$/;
const lower = (value) => value.toLowerCase();
const normalizeWallet = (value) => typeof value === 'string' && isAddress(value) ? getAddress(value).toLowerCase() : null;
const toJson = (value) => typeof value === 'bigint' ? value.toString() : Array.isArray(value) ? value.map(toJson) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)])) : value;
const boundedLimit = (value, fallback = 50) => Math.min(100, Math.max(1, Number.isInteger(Number(value)) ? Number(value) : fallback));
const loanJson = (loan) => toJson({ borrower: loan.borrower, lender: loan.lender, collateralETH: loan.collateralETH, principal: loan.principal, principalOutstanding: loan.principalOutstanding, accruedInterest: loan.accruedInterest, fees: loan.fees, aprBps: loan.aprBps, start: loan.start, lastAccrual: loan.lastAccrual, maturity: loan.maturity, graceEnd: loan.graceEnd, marginCallAt: loan.marginCallAt, marginCallCureEnd: loan.marginCallCureEnd, state: loan.state, lateFeeAssessed: loan.lateFeeAssessed, reserveContribution: loan.reserveContribution, badDebt: loan.badDebt, totalRepaid: loan.totalRepaid });
const requestJson = (request) => toJson({ borrower: request.borrower, principal: request.principal, collateral: request.collateral, term: request.term, state: request.state, lender: request.lender, loanId: request.loanId, initialLtvBps: request.initialLtvBps });
const certificateJson = (certificate) => toJson({ loanId: certificate.loanId, requestId: certificate.requestId, borrower: certificate.borrower, lender: certificate.lender, platform: certificate.platform, principal: certificate.principal, collateral: certificate.collateral, agreedInterest: certificate.agreedInterest, totalScheduledRepayment: certificate.totalScheduledRepayment, actualRepayment: certificate.actualRepayment, certificateValue: certificate.certificateValue, aprBps: certificate.aprBps, start: certificate.start, maturity: certificate.maturity, completedAt: certificate.completedAt, status: certificate.status, role: certificate.role, isP2P: certificate.isP2P, metadataHash: certificate.metadataHash });
const scheduleJson = (schedule) => schedule.map((item) => toJson({ dueAt: item.dueAt, amount: item.amount, paid: item.paid }));

function createLendingV2ReadController({ manifest, artifacts, models, provider = new JsonRpcProvider(manifest.rpcUrl) }) {
  const pool = new Contract(manifest.contracts.LendingPoolV2.address, artifacts.LendingPoolV2.abi, provider);
  const vault = new Contract(manifest.contracts.CollateralVaultV2.address, artifacts.CollateralVaultV2.abi, provider);
  const manager = new Contract(manifest.contracts.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
  const marketplace = new Contract(manifest.contracts.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, provider);
  const liquidation = new Contract(manifest.contracts.LiquidationV2.address, artifacts.LiquidationV2.abi, provider);
  const reserve = new Contract(manifest.contracts.InsuranceReserveV2.address, artifacts.InsuranceReserveV2.abi, provider);
  const emi = new Contract(manifest.contracts.EMIManagerV2.address, artifacts.EMIManagerV2.abi, provider);
  const nft = new Contract(manifest.contracts.LoanNFTV2.address, artifacts.LoanNFTV2.abi, provider);
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
    const [accruedInterest, outstanding, lateFee, totalRepayment, state, currentLtvBps, healthFactor, liquidatable, quote, schedule] = await Promise.all([
      manager.previewAccruedInterest(loanId), manager.previewOutstanding(loanId), manager.previewLateFee(loanId), manager.previewTotalRepayment(loanId), manager.previewLoanStatus(loanId),
      liquidation.currentLtvBps(loanId), liquidation.healthFactor(loanId), liquidation.isLiquidatable(loanId), liquidation.previewLiquidation(loanId), emi.getSchedule(loanId),
    ]);
    const roleNames = ['LENDER', 'BORROWER', 'PLATFORM'];
    const certificateIds = await Promise.all([0, 1, 2].map((role) => nft.loanCertificates(loanId, role)));
    const certificates = (await Promise.all(certificateIds.map(async (certificateTokenId, role) => {
      if (certificateTokenId === 0n) return null;
      const [owner, tokenURI, certificate] = await Promise.all([nft.ownerOf(certificateTokenId), nft.tokenURI(certificateTokenId), nft.getCertificate(certificateTokenId)]);
      return { role: roleNames[role], tokenId: certificateTokenId, owner, tokenURI, certificate: certificateJson(certificate) };
    }))).filter(Boolean);
    const borrowerCertificate = certificates.find((certificate) => certificate.role === 'BORROWER') || null;
    return toJson({ loan: loanJson(record), previews: { accruedInterest, outstanding, lateFee, totalRepayment, state, currentLtvBps, healthFactor, liquidatable, liquidation: quote }, schedule: scheduleJson(schedule), certificate: borrowerCertificate, certificates });
  };
  const includesWallet = (value, wallet) => typeof value === 'string'
    ? value.toLowerCase() === wallet
    : Array.isArray(value) ? value.some((item) => includesWallet(item, wallet))
      : value && typeof value === 'object' ? Object.values(value).some((item) => includesWallet(item, wallet)) : false;
  const eventList = (filter, count) => models.V2ChainEvent.find({ chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion, ...filter }).sort({ blockNumber: 1, logIndex: 1 }).limit(count).lean();
  const readRequest = async (requestId) => {
    const request = await marketplace.requests(requestId);
    if (lower(request.borrower) === '0x0000000000000000000000000000000000000000') return null;
    return requestJson(request);
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
      const [balance, fundingEvents, payoutEvents, accountingEvents] = await Promise.all([
        reserve.availableBalance(),
        eventList({ contractName: 'InsuranceReserveV2', eventName: 'ReserveFunded' }, 100),
        eventList({ contractName: 'InsuranceReserveV2', eventName: 'ReserveUsed' }, 100),
        eventList({ contractName: 'InsuranceReserveV2', eventName: 'ReserveBalanceUpdated' }, 100),
      ]);
      // The balance is read directly from InsuranceReserveV2. Events are an
      // indexed audit projection, never a source of financial authority.
      res.json({ source: source(), ...state, data: { balance: balance.toString(), fundingEvents, payoutEvents, accountingEvents } });
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
    history: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res, []); if (state) { const all = await eventList({}, 500); res.json({ source: source(), ...state, data: all.filter((event) => String(event.args.loanId || '') === id).slice(-100) }); } } catch (error) { next(error); } },
    preview: async (req, res, next) => { try { const id = req.params.loanId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Loan ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res); if (state) { const data = await readLoan(id); if (!data) return res.status(404).json({ source: source(), ...state, status: 'NOT_FOUND', data: null }); res.json({ source: source(), ...state, data: data.previews }); } } catch (error) { next(error); } },
    request: async (req, res, next) => { try { const id = req.params.requestId; if (!UINT.test(id) || BigInt(id) === 0n) return res.status(400).json({ status: 'INVALID_REQUEST', message: 'Request ID must be a positive uint256 decimal string.' }); const state = await requireAvailable(res); if (state) { const data = await readRequest(id); if (!data) return res.status(404).json({ source: source(), ...state, status: 'NOT_FOUND', data: null }); const history = (await eventList({}, 1_000)).filter((event) => String(event.args.requestId || '') === id); res.json({ source: source(), ...state, data: { requestId: id, request: data, history } }); } } catch (error) { next(error); } },
  };
}
module.exports = { createLendingV2ReadController, normalizeWallet };
