const { Contract } = require('ethers');

// Exact order from ILoanManager.LoanStatus: ACTIVE, REPAID, LIQUIDATED, DEFAULTED.
const LOAN_STATUS = Object.freeze({ 0: 'ACTIVE', 1: 'REPAID', 2: 'LIQUIDATED', 3: 'DEFAULTED' });
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function lower(value) { return typeof value === 'string' ? value.toLowerCase() : value; }
function decimal(value) { return typeof value === 'bigint' ? value.toString() : String(value); }
function status(value) { return LOAN_STATUS[Number(value)] || null; }
function provenance(event) {
  return {
    chainId: String(event.chainId), contractAddress: lower(event.contractAddress), transactionHash: lower(event.transactionHash),
    blockNumber: String(event.blockNumber), transactionIndex: Number(event.transactionIndex), logIndex: Number(event.logIndex),
    blockHash: lower(event.blockHash), eventName: event.eventName,
  };
}
function canonicalSort(events) {
  return [...events].sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber) || Number(a.transactionIndex) - Number(b.transactionIndex) || Number(a.logIndex) - Number(b.logIndex));
}
function isZeroAddress(value) { return !value || lower(value) === ZERO_ADDRESS; }

function normaliseLoan(record) {
  return {
    loanId: decimal(record.loanId), borrower: lower(record.borrower), lender: lower(record.lender), principal: decimal(record.principal),
    collateralETH: decimal(record.collateralETH), interestRateBps: decimal(record.interestRateBps), durationMonths: decimal(record.durationMonths),
    emiAmount: decimal(record.emiAmount), startTime: decimal(record.startTime), lastInterestTime: decimal(record.lastInterestTime),
    totalRepaid: decimal(record.totalRepaid), status: status(record.status),
  };
}
function normaliseRequest(record) {
  return {
    requestId: decimal(record.id), borrower: lower(record.borrower), principal: decimal(record.principalAmount), interestRateBps: decimal(record.interestRateBps),
    durationMonths: decimal(record.durationMonths), emiAmount: decimal(record.emiAmount), collateralETH: decimal(record.collateralETH),
    purpose: record.purpose || null, status: ['OPEN', 'FUNDED', 'CANCELLED'][Number(record.status)] || null,
    lender: isZeroAddress(record.lender) ? null : lower(record.lender),
  };
}
function normaliseInstallment(record) {
  return { installmentId: decimal(record.installmentId), loanId: decimal(record.loanId), dueDate: decimal(record.dueDate), amount: decimal(record.amount), paid: Boolean(record.isPaid), paidAt: decimal(record.paidTimestamp) };
}

function createEthersStateReader({ manifest, artifacts, provider }) {
  const marketplace = new Contract(manifest.contracts.loanMarketplace, artifacts.loanMarketplace.abi, provider);
  const loanManager = new Contract(manifest.contracts.loanManager, artifacts.loanManager.abi, provider);
  const emiManager = new Contract(manifest.contracts.emiManager, artifacts.emiManager.abi, provider);
  const atBlock = (blockNumber) => ({ blockTag: Number(blockNumber) });
  return {
    async getLoanRequest(requestId, blockNumber) { return normaliseRequest(await marketplace.loanRequests(requestId, atBlock(blockNumber))); },
    async getLoan(loanId, blockNumber) { return normaliseLoan(await loanManager.getLoan(loanId, atBlock(blockNumber))); },
    async getSchedule(loanId, blockNumber) { return (await emiManager.getSchedule(loanId, atBlock(blockNumber))).map(normaliseInstallment); },
    async getNextInstallmentIndex(loanId, blockNumber) { return decimal(await emiManager.nextInstallmentIndex(loanId, atBlock(blockNumber))); },
  };
}

function createMongoProjectionStore(models) {
  const projectionModels = ['LoanRequest', 'Loan', 'EMISchedule', 'EMIInstallment', 'Repayment', 'LoanDefault', 'Liquidation', 'CollateralMovement', 'LoanStateTransition', 'ReconciliationError'];
  const one = (model, filter, update) => models[model].updateOne(filter, { $set: update }, { upsert: true, setDefaultsOnInsert: true });
  return {
    async listCanonicalEvents({ chainId, deploymentBlock, contractAddresses }) {
      return models.ChainEvent.aggregate([
        { $match: { chainId: String(chainId), removed: false, contractAddress: { $in: contractAddresses.map(lower) } } },
        { $addFields: { blockSort: { $convert: { input: '$blockNumber', to: 'long', onError: -1, onNull: -1 } } } },
        { $match: { blockSort: { $gte: Number(deploymentBlock) } } },
        { $sort: { blockSort: 1, transactionIndex: 1, logIndex: 1 } },
        { $project: { _id: 0, blockSort: 0 } },
      ]);
    },
    findEventsByTransaction(chainId, transactionHash) { return models.ChainEvent.find({ chainId: String(chainId), transactionHash: lower(transactionHash), removed: false }).sort({ blockNumber: 1, transactionIndex: 1, logIndex: 1 }).lean(); },
    getLoan(chainId, address, loanId) { return models.Loan.findOne({ chainId: String(chainId), loanManagerAddress: lower(address), loanId: String(loanId) }).lean(); },
    getRequest(chainId, address, requestId) { return models.LoanRequest.findOne({ chainId: String(chainId), loanMarketplaceAddress: lower(address), requestId: String(requestId) }).lean(); },
    getRequestByLoan(chainId, address, loanId) { return models.LoanRequest.findOne({ chainId: String(chainId), loanMarketplaceAddress: lower(address), loanId: String(loanId) }).lean(); },
    getInstallment(chainId, address, loanId, installmentId) { return models.EMIInstallment.findOne({ chainId: String(chainId), emiManagerAddress: lower(address), loanId: String(loanId), installmentId: String(installmentId) }).lean(); },
    upsertRequest(doc) { return one('LoanRequest', { chainId: doc.chainId, loanMarketplaceAddress: doc.loanMarketplaceAddress, requestId: doc.requestId }, doc); },
    upsertLoan(doc) { return one('Loan', { chainId: doc.chainId, loanManagerAddress: doc.loanManagerAddress, loanId: doc.loanId }, doc); },
    upsertSchedule(doc) { return one('EMISchedule', { chainId: doc.chainId, emiManagerAddress: doc.emiManagerAddress, loanId: doc.loanId }, doc); },
    upsertInstallment(doc) { return one('EMIInstallment', { chainId: doc.chainId, emiManagerAddress: doc.emiManagerAddress, loanId: doc.loanId, installmentId: doc.installmentId }, doc); },
    updateInstallment(chainId, address, loanId, installmentId, update) { return models.EMIInstallment.updateOne({ chainId: String(chainId), emiManagerAddress: lower(address), loanId: String(loanId), installmentId: String(installmentId) }, { $set: update }); },
    upsertRepayment(doc) { return one('Repayment', { chainId: doc.chainId, transactionHash: doc.transactionHash, 'emiEvidence.logIndex': doc.emiEvidence.logIndex }, doc); },
    upsertDefault(doc) { return one('LoanDefault', { chainId: doc.chainId, 'emiDefaultEvidence.contractAddress': doc.emiDefaultEvidence.contractAddress, loanId: doc.loanId, installmentId: doc.installmentId }, doc); },
    upsertLiquidation(doc) { return one('Liquidation', { chainId: doc.chainId, 'marketplaceEvidence.contractAddress': doc.marketplaceEvidence.contractAddress, loanId: doc.loanId }, doc); },
    upsertCollateral(doc) { return one('CollateralMovement', { chainId: doc.chainId, transactionHash: doc.transactionHash, logIndex: doc.logIndex }, doc); },
    attributeCollateral(chainId, transactionHash, logIndex, update) { return models.CollateralMovement.updateOne({ chainId: String(chainId), transactionHash: lower(transactionHash), logIndex: Number(logIndex) }, { $set: update }); },
    appendTransition(doc) { return models.LoanStateTransition.updateOne({ chainId: doc.chainId, 'evidence.transactionHash': doc.evidence.transactionHash, 'evidence.logIndex': doc.evidence.logIndex }, { $setOnInsert: doc }, { upsert: true }); },
    recordError(doc) { return models.ReconciliationError.updateOne({ chainId: doc.chainId, code: doc.code, transactionHash: doc.transactionHash, logIndex: doc.logIndex }, { $set: doc }, { upsert: true }); },
    async clearProjections(chainId) { await Promise.all(projectionModels.map((name) => models[name].deleteMany({ chainId: String(chainId) }))); },
  };
}

class LendingProjectionEngine {
  constructor({ manifest, store, stateReader, logger = console }) {
    if (!manifest || !store || !stateReader) throw new Error('manifest, store, and stateReader are required for projections');
    this.manifest = manifest; this.store = store; this.stateReader = stateReader; this.logger = logger;
  }
  log(level, message, context = {}) { if (typeof this.logger[level] === 'function') this.logger[level]({ component: 'lending-projection', chainId: this.manifest.chainId, message, ...context }); }
  contractAddresses() { return Object.values(this.manifest.contracts).map(lower); }
  context(rebuilding = false) { return { rebuilding, loans: new Map(), requests: new Map(), installments: new Map() }; }
  key(...parts) { return parts.join(':'); }
  async error(code, event, details) {
    const doc = { chainId: String(event.chainId), code, transactionHash: lower(event.transactionHash), logIndex: Number(event.logIndex), eventEvidence: provenance(event), details };
    this.log('error', 'Projection reconciliation error', { code, transactionHash: doc.transactionHash, logIndex: doc.logIndex, eventName: event.eventName, details });
    await this.store.recordError(doc);
  }
  async requestFor(context, requestId) {
    const key = this.key('request', requestId); if (context.requests.has(key)) return context.requests.get(key);
    if (context.rebuilding) return null;
    return this.store.getRequest(String(this.manifest.chainId), this.manifest.contracts.loanMarketplace, requestId);
  }
  async loanFor(context, loanId) {
    const key = this.key('loan', loanId); if (context.loans.has(key)) return context.loans.get(key);
    if (context.rebuilding) return null;
    return this.store.getLoan(String(this.manifest.chainId), this.manifest.contracts.loanManager, loanId);
  }
  async processEvent(event, context = this.context(false)) {
    if (event.removed) return;
    switch (event.eventName) {
      case 'RequestCreated': return this.requestCreated(event, context);
      case 'RequestFunded': return this.requestFunded(event, context);
      case 'RequestCancelled': return this.requestCancelled(event, context);
      case 'LoanCreated': return this.loanCreated(event, context);
      case 'LoanRepaid': return this.loanRepaid(event, context);
      case 'LoanDefaulted': return this.loanDefaulted(event, context);
      case 'LoanLiquidated': return this.loanLiquidated(event, context);
      case 'EMIScheduleCreated': return this.scheduleCreated(event, context);
      case 'EMIPaid': return this.emiPaid(event, context);
      case 'EMIDefaulted': return this.emiDefaulted(event, context);
      case 'P2PLoanLiquidated': return this.p2pLiquidated(event, context);
      case 'CollateralETHDeposited': case 'CollateralERC20Deposited': case 'CollateralETHReleased': case 'CollateralERC20Released': case 'CollateralETHLiquidated': case 'CollateralERC20Liquidated': return this.collateral(event, context);
      default: return undefined;
    }
  }
  async requestCreated(event, context) {
    const request = await this.stateReader.getLoanRequest(event.args.requestId, event.blockNumber); const evidence = provenance(event);
    const doc = { chainId: String(event.chainId), loanMarketplaceAddress: lower(event.contractAddress), ...request, status: 'OPEN', createdEvidence: evidence, fundedEvidence: null, cancelledEvidence: null };
    await this.store.upsertRequest(doc); context.requests.set(this.key('request', request.requestId), doc); await this.attributeCollateralForTransaction(event, context);
  }
  async requestFunded(event, context) {
    const request = await this.stateReader.getLoanRequest(event.args.requestId, event.blockNumber); const previous = await this.requestFor(context, event.args.requestId); const evidence = provenance(event);
    if (!previous) await this.error('REQUEST_FUNDED_WITHOUT_REQUEST_CREATED', event, { requestId: String(event.args.requestId) });
    const doc = { chainId: String(event.chainId), loanMarketplaceAddress: lower(event.contractAddress), ...request, lender: lower(event.args.lender), status: 'FUNDED', loanId: String(event.args.loanId), createdEvidence: previous?.createdEvidence || evidence, fundedEvidence: evidence, cancelledEvidence: null };
    await this.store.upsertRequest(doc); context.requests.set(this.key('request', doc.requestId), doc);
    const loan = await this.loanFor(context, event.args.loanId);
    if (loan) { const updated = { ...loan, loanMarketplaceAddress: lower(event.contractAddress), requestId: doc.requestId }; await this.store.upsertLoan(updated); context.loans.set(this.key('loan', updated.loanId), updated); }
  }
  async requestCancelled(event, context) {
    const request = await this.stateReader.getLoanRequest(event.args.requestId, event.blockNumber); const previous = await this.requestFor(context, event.args.requestId); const evidence = provenance(event);
    if (!previous) await this.error('REQUEST_CANCELLED_WITHOUT_REQUEST_CREATED', event, { requestId: String(event.args.requestId) });
    const doc = { chainId: String(event.chainId), loanMarketplaceAddress: lower(event.contractAddress), ...request, status: 'CANCELLED', loanId: previous?.loanId || null, createdEvidence: previous?.createdEvidence || evidence, fundedEvidence: previous?.fundedEvidence || null, cancelledEvidence: evidence };
    await this.store.upsertRequest(doc); context.requests.set(this.key('request', doc.requestId), doc); await this.attributeCollateralForTransaction(event, context);
  }
  async loanCreated(event, context) {
    const loan = await this.stateReader.getLoan(event.args.loanId, event.blockNumber); const evidence = provenance(event);
    if (loan.status !== 'ACTIVE') await this.error('LOAN_CREATED_WITH_NON_ACTIVE_STATE', event, { status: loan.status });
    const doc = { chainId: String(event.chainId), loanManagerAddress: lower(event.contractAddress), loanMarketplaceAddress: null, requestId: null, ...loan, createdEvidence: evidence, latestStateEvidence: evidence };
    await this.store.upsertLoan(doc); context.loans.set(this.key('loan', loan.loanId), doc); await this.transition(event, context, null, 'ACTIVE');
  }
  async loanRepaid(event, context) {
    const loan = await this.stateReader.getLoan(event.args.loanId, event.blockNumber); const prior = await this.loanFor(context, event.args.loanId); const next = status(event.args.newStatus); const evidence = provenance(event);
    if (!prior) await this.error('LOAN_REPAID_WITHOUT_LOAN_CREATED', event, { loanId: String(event.args.loanId) });
    if (!next || (next !== 'ACTIVE' && next !== 'REPAID')) await this.error('INVALID_LOAN_REPAID_STATUS', event, { newStatus: event.args.newStatus });
    const doc = { ...(prior || {}), chainId: String(event.chainId), loanManagerAddress: lower(event.contractAddress), ...loan, createdEvidence: prior?.createdEvidence || evidence, latestStateEvidence: evidence };
    await this.store.upsertLoan(doc); context.loans.set(this.key('loan', loan.loanId), doc);
    if (prior && next && prior.status !== next) await this.transition(event, context, prior.status, next);
  }
  async loanDefaulted(event, context) { await this.loanStateEvent(event, context, 'DEFAULTED', ['ACTIVE']); }
  async loanLiquidated(event, context) { await this.loanStateEvent(event, context, 'LIQUIDATED', ['ACTIVE', 'DEFAULTED']); }
  async loanStateEvent(event, context, expected, allowed) {
    const loan = await this.stateReader.getLoan(event.args.loanId, event.blockNumber); const prior = await this.loanFor(context, event.args.loanId); const evidence = provenance(event);
    if (!prior) await this.error('LOAN_STATE_EVENT_WITHOUT_LOAN_CREATED', event, { loanId: String(event.args.loanId), expected });
    if (!allowed.includes(prior?.status)) { await this.error('IMPOSSIBLE_LOAN_STATE_TRANSITION', event, { fromStatus: prior?.status || null, toStatus: expected, allowed }); return; }
    if (loan.status !== expected) { await this.error('INCONSISTENT_LOAN_STATE_READ', event, { expected, observed: loan.status }); return; }
    const doc = { ...prior, chainId: String(event.chainId), loanManagerAddress: lower(event.contractAddress), ...loan, createdEvidence: prior.createdEvidence, latestStateEvidence: evidence };
    await this.store.upsertLoan(doc); context.loans.set(this.key('loan', loan.loanId), doc); await this.transition(event, context, prior.status, expected);
  }
  async transition(event, context, fromStatus, toStatus) {
    if (fromStatus === toStatus) return;
    await this.store.appendTransition({ chainId: String(event.chainId), loanManagerAddress: lower(this.manifest.contracts.loanManager), loanId: String(event.args.loanId), fromStatus, toStatus, reasonEvent: event.eventName, evidence: provenance(event) });
  }
  async scheduleCreated(event, context) {
    const schedule = await this.stateReader.getSchedule(event.args.loanId, event.blockNumber); const nextInstallmentIndex = await this.stateReader.getNextInstallmentIndex(event.args.loanId, event.blockNumber); const evidence = provenance(event);
    await this.store.upsertSchedule({ chainId: String(event.chainId), emiManagerAddress: lower(event.contractAddress), loanId: String(event.args.loanId), totalInstallments: String(event.args.totalInstallments), emiAmount: String(event.args.emiAmount), nextInstallmentIndex, scheduleEvidence: evidence });
    for (const installment of schedule) {
      const doc = { chainId: String(event.chainId), emiManagerAddress: lower(event.contractAddress), ...installment, scheduleEvidence: evidence, paymentEvidence: null, defaultEvidence: null };
      await this.store.upsertInstallment(doc); context.installments.set(this.key('installment', doc.loanId, doc.installmentId), doc);
    }
  }
  async emiPaid(event, context) {
    const key = this.key('installment', event.args.loanId, event.args.installmentId); let installment = context.installments.get(key);
    if (!installment && !context.rebuilding) installment = await this.store.getInstallment(String(event.chainId), event.contractAddress, event.args.loanId, event.args.installmentId);
    if (!installment) { await this.error('EMI_PAYMENT_FOR_UNKNOWN_INSTALLMENT', event, { loanId: String(event.args.loanId), installmentId: String(event.args.installmentId) }); return; }
    const schedule = await this.stateReader.getSchedule(event.args.loanId, event.blockNumber); const authoritative = schedule.find((item) => item.installmentId === String(event.args.installmentId));
    if (!authoritative || !authoritative.paid) { await this.error('EMI_PAYMENT_INCONSISTENT_SCHEDULE_READ', event, { loanId: String(event.args.loanId), installmentId: String(event.args.installmentId) }); return; }
    const updated = { ...installment, amount: authoritative.amount, dueDate: authoritative.dueDate, paid: true, paidAt: authoritative.paidAt, paymentEvidence: provenance(event) };
    await this.store.upsertInstallment(updated); context.installments.set(key, updated); await this.reconcileRepayment(event, context);
  }
  async reconcileRepayment(event, context) {
    const events = await this.store.findEventsByTransaction(String(event.chainId), event.transactionHash); const loan = await this.stateReader.getLoan(event.args.loanId, event.blockNumber);
    const loanRepaid = events.find((item) => item.eventName === 'LoanRepaid' && String(item.args.loanId) === String(event.args.loanId));
    const transfer = events.find((item) => item.eventName === 'Transfer' && lower(item.args.from) === lower(event.args.payer) && lower(item.args.to) === loan.lender && String(item.args.value) === String(event.args.amount));
    if (!loanRepaid || !transfer) { await this.error('REPAYMENT_MISSING_REQUIRED_EVIDENCE', event, { hasEMIPaid: true, hasLoanRepaid: Boolean(loanRepaid), hasABCDTransfer: Boolean(transfer) }); return; }
    await this.store.upsertRepayment({ chainId: String(event.chainId), loanId: String(event.args.loanId), installmentId: String(event.args.installmentId), borrower: lower(event.args.payer), lender: loan.lender, amount: String(event.args.amount), transactionHash: lower(event.transactionHash), emiEvidence: provenance(event), loanRepaymentEvidence: provenance(loanRepaid), tokenTransferEvidence: provenance(transfer), lenderDerivation: { source: 'LOAN_MANAGER_GET_LOAN', loanManagerAddress: lower(this.manifest.contracts.loanManager), observedAtBlock: String(event.blockNumber) } });
  }
  async emiDefaulted(event, context) {
    const key = this.key('installment', event.args.loanId, event.args.installmentId); let installment = context.installments.get(key);
    if (!installment && !context.rebuilding) installment = await this.store.getInstallment(String(event.chainId), event.contractAddress, event.args.loanId, event.args.installmentId);
    if (!installment) { await this.error('EMI_DEFAULT_FOR_UNKNOWN_INSTALLMENT', event, { loanId: String(event.args.loanId), installmentId: String(event.args.installmentId) }); return; }
    const events = await this.store.findEventsByTransaction(String(event.chainId), event.transactionHash); const loanDefault = events.find((item) => item.eventName === 'LoanDefaulted' && String(item.args.loanId) === String(event.args.loanId));
    if (!loanDefault) { await this.error('DEFAULT_MISSING_LOAN_DEFAULT_EVIDENCE', event, { loanId: String(event.args.loanId) }); return; }
    const loan = await this.stateReader.getLoan(event.args.loanId, event.blockNumber); const evidence = provenance(event);
    await this.store.upsertInstallment({ ...installment, defaultEvidence: evidence }); context.installments.set(key, { ...installment, defaultEvidence: evidence });
    await this.store.upsertDefault({ chainId: String(event.chainId), loanId: String(event.args.loanId), installmentId: String(event.args.installmentId), borrower: loan.borrower, dueDate: String(event.args.dueDate), emiDefaultEvidence: evidence, loanDefaultEvidence: provenance(loanDefault) });
  }
  async p2pLiquidated(event, context) {
    const events = await this.store.findEventsByTransaction(String(event.chainId), event.transactionHash);
    const loanLiquidated = events.find((item) => item.eventName === 'LoanLiquidated' && String(item.args.loanId) === String(event.args.loanId));
    const collateral = events.find((item) => item.eventName === 'CollateralETHLiquidated' && String(item.args.amount) === String(event.args.collateralETH));
    if (!loanLiquidated || !collateral) { await this.error('LIQUIDATION_MISSING_REQUIRED_EVIDENCE', event, { hasLoanLiquidated: Boolean(loanLiquidated), hasCollateralLiquidated: Boolean(collateral) }); return; }
    const loan = await this.stateReader.getLoan(event.args.loanId, event.blockNumber); const request = await this.requestFor(context, event.args.requestId);
    if (!request) await this.error('LIQUIDATION_WITHOUT_REQUEST', event, { requestId: String(event.args.requestId) });
    await this.store.upsertLiquidation({ chainId: String(event.chainId), loanId: String(event.args.loanId), requestId: String(event.args.requestId), borrower: loan.borrower, lender: lower(event.args.lender), collateralETH: String(event.args.collateralETH), marketplaceEvidence: provenance(event), loanLiquidationEvidence: provenance(loanLiquidated), collateralEvidence: provenance(collateral) });
    await this.attributeCollateralForTransaction(event, context);
  }
  async collateral(event, context) {
    const name = event.eventName; const isErc20 = name.includes('ERC20'); const direction = name.includes('Deposited') ? 'CREDIT' : 'DEBIT';
    const party = lower(event.args.borrower || event.args.recipient || event.args.liquidator); const doc = { chainId: String(event.chainId), collateralVaultAddress: lower(event.contractAddress), transactionHash: lower(event.transactionHash), blockNumber: String(event.blockNumber), transactionIndex: Number(event.transactionIndex), logIndex: Number(event.logIndex), blockHash: lower(event.blockHash), eventName: name, borrowerOrRecipient: party, tokenAddress: isErc20 ? lower(event.args.token) : null, assetType: isErc20 ? 'ERC20' : 'ETH', direction, amount: String(event.args.amount), requestId: null, loanId: null, attribution: 'UNATTRIBUTED', attributionEvidence: null };
    await this.store.upsertCollateral(doc); await this.attributeCollateralForTransaction(event, context);
  }
  async attributeCollateralForTransaction(event, context) {
    const events = await this.store.findEventsByTransaction(String(event.chainId), event.transactionHash);
    const movement = events.find((item) => item.eventName.startsWith('Collateral'));
    if (!movement) return;
    let lifecycle = events.find((item) => item.eventName === 'P2PLoanLiquidated') || events.find((item) => item.eventName === 'RequestCancelled') || events.find((item) => item.eventName === 'RequestCreated');
    let requestId = lifecycle?.args.requestId || null; let loanId = lifecycle?.args.loanId || null;
    if (!requestId && movement.eventName === 'CollateralETHReleased') {
      const repaid = events.find((item) => item.eventName === 'LoanRepaid');
      if (repaid) { const loan = await this.loanFor(context, repaid.args.loanId); requestId = loan?.requestId || null; loanId = loan?.loanId || repaid.args.loanId; }
    }
    if (!requestId && !loanId) return;
    await this.store.attributeCollateral(String(event.chainId), movement.transactionHash, movement.logIndex, { requestId: requestId ? String(requestId) : null, loanId: loanId ? String(loanId) : null, attribution: 'SAME_TRANSACTION_UNAMBIGUOUS', attributionEvidence: provenance(lifecycle || event) });
  }
  async rebuildLendingProjection({ chainId = String(this.manifest.chainId), deploymentVersion = this.manifest.deploymentVersion } = {}) {
    if (String(chainId) !== String(this.manifest.chainId) || deploymentVersion !== this.manifest.deploymentVersion) throw new Error('Rebuild scope does not match the canonical deployment manifest');
    await this.store.clearProjections(String(chainId)); const events = canonicalSort(await this.store.listCanonicalEvents({ chainId, deploymentBlock: this.manifest.deploymentBlock, contractAddresses: this.contractAddresses() })); const context = this.context(true);
    for (const event of events) await this.processEvent(event, context);
    return { chainId: String(chainId), deploymentVersion, processedEvents: events.length };
  }
}

module.exports = { LOAN_STATUS, provenance, canonicalSort, createEthersStateReader, createMongoProjectionStore, LendingProjectionEngine };
