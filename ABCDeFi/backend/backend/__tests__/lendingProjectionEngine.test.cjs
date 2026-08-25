const test = require('node:test');
const assert = require('node:assert/strict');

const { loadLendingManifest } = require('../config/lendingManifest.cjs');
const { LendingProjectionEngine, LOAN_STATUS } = require('../modules/lendingProjection/projection');

// Deterministic fixtures in this file are test-only and are never runtime blockchain data.
// Projection fixtures use synthetic events beginning at block 1. Keep that
// test boundary independent of the current local deployment block, which is
// intentionally recorded from the real deployment manifest.
const loadedManifest = loadLendingManifest();
const manifest = {
  ...loadedManifest,
  deploymentBlock: 1,
  contracts: { ...loadedManifest.contracts },
  rawContracts: { ...loadedManifest.rawContracts },
};
const hash = (value) => `0x${value.toString(16).padStart(64, '0')}`;
const address = (value) => `0x${value.toString(16).padStart(40, '0')}`;
const borrower = address(1); const lender = address(2);
const contract = Object.fromEntries(Object.entries(manifest.contracts).map(([key, value]) => [key, value.toLowerCase()]));

function event(eventName, args, { block = 1, transaction = 1, log = 0, contractAddress } = {}) {
  const eventContracts = {
    RequestCreated: contract.loanMarketplace, RequestFunded: contract.loanMarketplace, RequestCancelled: contract.loanMarketplace, P2PLoanLiquidated: contract.loanMarketplace,
    LoanCreated: contract.loanManager, LoanRepaid: contract.loanManager, LoanDefaulted: contract.loanManager, LoanLiquidated: contract.loanManager,
    EMIScheduleCreated: contract.emiManager, EMIPaid: contract.emiManager, EMIDefaulted: contract.emiManager,
    CollateralETHDeposited: contract.collateralVault, CollateralETHReleased: contract.collateralVault, CollateralETHLiquidated: contract.collateralVault,
    Transfer: contract.abcdToken,
  };
  return { chainId: String(manifest.chainId), contractAddress: contractAddress || eventContracts[eventName], transactionHash: hash(transaction), blockNumber: String(block), transactionIndex: 0, logIndex: log, blockHash: hash(1000 + block), eventName, eventSignature: `${eventName}(fixture)`, topic0: hash(2000 + log), topics: [], data: '0x', args, removed: false };
}
function loan(overrides = {}) { return { loanId: '1', borrower, lender, principal: '100', collateralETH: '50', interestRateBps: '1200', durationMonths: '2', emiAmount: '55', startTime: '10', lastInterestTime: '10', totalRepaid: '0', status: 'ACTIVE', ...overrides }; }
function request(overrides = {}) { return { requestId: '1', borrower, lender: null, principal: '100', collateralETH: '50', interestRateBps: '1200', durationMonths: '2', emiAmount: '55', purpose: 'fixture purpose', status: 'OPEN', ...overrides }; }
function installment(overrides = {}) { return { installmentId: '0', loanId: '1', dueDate: '40', amount: '55', paid: false, paidAt: '0', ...overrides }; }

class Store {
  constructor(events = []) { this.events = events; this.clear(); }
  clear() { this.requests = new Map(); this.loans = new Map(); this.schedules = new Map(); this.installments = new Map(); this.repayments = new Map(); this.defaults = new Map(); this.liquidations = new Map(); this.collateral = new Map(); this.transitions = new Map(); this.errors = new Map(); }
  async listCanonicalEvents({ chainId, deploymentBlock, contractAddresses }) { return this.events.filter((item) => !item.removed && item.chainId === String(chainId) && Number(item.blockNumber) >= deploymentBlock && contractAddresses.includes(item.contractAddress)); }
  async findEventsByTransaction(chainId, transactionHash) { return this.events.filter((item) => !item.removed && item.chainId === String(chainId) && item.transactionHash === transactionHash); }
  async getLoan(_chain, _address, loanId) { return this.loans.get(String(loanId)) || null; }
  async getRequest(_chain, _address, requestId) { return this.requests.get(String(requestId)) || null; }
  async getRequestByLoan(_chain, _address, loanId) { return [...this.requests.values()].find((item) => item.loanId === String(loanId)) || null; }
  async getInstallment(_chain, _address, loanId, installmentId) { return this.installments.get(`${loanId}:${installmentId}`) || null; }
  async upsertRequest(doc) { this.requests.set(doc.requestId, structuredClone(doc)); }
  async upsertLoan(doc) { this.loans.set(doc.loanId, structuredClone(doc)); }
  async upsertSchedule(doc) { this.schedules.set(doc.loanId, structuredClone(doc)); }
  async upsertInstallment(doc) { this.installments.set(`${doc.loanId}:${doc.installmentId}`, structuredClone(doc)); }
  async updateInstallment(_chain, _address, loanId, installmentId, update) { Object.assign(this.installments.get(`${loanId}:${installmentId}`), update); }
  async upsertRepayment(doc) { this.repayments.set(`${doc.transactionHash}:${doc.emiEvidence.logIndex}`, structuredClone(doc)); }
  async upsertDefault(doc) { this.defaults.set(`${doc.loanId}:${doc.installmentId}`, structuredClone(doc)); }
  async upsertLiquidation(doc) { this.liquidations.set(doc.loanId, structuredClone(doc)); }
  async upsertCollateral(doc) { this.collateral.set(`${doc.transactionHash}:${doc.logIndex}`, structuredClone(doc)); }
  async attributeCollateral(_chain, tx, log, update) { Object.assign(this.collateral.get(`${tx}:${log}`), update); }
  async appendTransition(doc) { this.transitions.set(`${doc.evidence.transactionHash}:${doc.evidence.logIndex}`, structuredClone(doc)); }
  async recordError(doc) { this.errors.set(`${doc.code}:${doc.transactionHash}:${doc.logIndex}`, structuredClone(doc)); }
  async clearProjections() { this.clear(); }
  snapshot() { return JSON.stringify(Object.fromEntries(['requests', 'loans', 'schedules', 'installments', 'repayments', 'defaults', 'liquidations', 'collateral', 'transitions', 'errors'].map((name) => [name, [...this[name].entries()].sort(([a], [b]) => a.localeCompare(b))]))); }
}

function reader({ loanAt = {}, requestAt = {}, scheduleAt = {} } = {}) {
  return {
    async getLoan(_loanId, block) { return structuredClone(loanAt[block] || loan()); },
    async getLoanRequest(_requestId, block) { return structuredClone(requestAt[block] || request()); },
    async getSchedule(_loanId, block) { return structuredClone(scheduleAt[block] || [installment()]); },
    async getNextInstallmentIndex() { return '0'; },
  };
}
function engine(events, state = {}) { const store = new Store(events); return { store, engine: new LendingProjectionEngine({ manifest, store, stateReader: reader(state), logger: { info() {}, warn() {}, error() {} } }) }; }
async function rebuild(events, state) { const subject = engine(events, state); await subject.engine.rebuildLendingProjection({}); return subject; }

test('uses the exact ILoanManager LoanStatus enum order', () => {
  assert.deepEqual(LOAN_STATUS, { 0: 'ACTIVE', 1: 'REPAID', 2: 'LIQUIDATED', 3: 'DEFAULTED' });
});

test('RequestCreated projects a canonical loan request', async () => {
  const item = event('RequestCreated', { requestId: '1', borrower, principal: '100', collateralETH: '50' }); const { store } = await rebuild([item], { requestAt: { 1: request() } });
  assert.equal(store.requests.get('1').status, 'OPEN'); assert.equal(store.requests.get('1').purpose, 'fixture purpose');
});
test('RequestFunded links the canonical request and loan', async () => {
  const events = [event('RequestCreated', { requestId: '1', borrower, principal: '100', collateralETH: '50' }, { block: 1 }), event('LoanCreated', { loanId: '1', borrower, principal: '100', collateralETH: '50', interestRateBps: '1200' }, { block: 2, transaction: 2 }), event('RequestFunded', { requestId: '1', lender, loanId: '1' }, { block: 2, transaction: 2, log: 2 })];
  const { store } = await rebuild(events, { requestAt: { 1: request(), 2: request({ lender, status: 'FUNDED' }) }, loanAt: { 2: loan() } });
  assert.equal(store.requests.get('1').loanId, '1'); assert.equal(store.loans.get('1').requestId, '1');
});
test('RequestCancelled updates a request from canonical state', async () => {
  const events = [event('RequestCreated', { requestId: '1', borrower, principal: '100', collateralETH: '50' }), event('RequestCancelled', { requestId: '1', borrower }, { block: 2, transaction: 2 })];
  const { store } = await rebuild(events, { requestAt: { 1: request(), 2: request({ status: 'CANCELLED' }) } }); assert.equal(store.requests.get('1').status, 'CANCELLED');
});
test('LoanCreated projects all authoritative LoanManager fields', async () => {
  const { store } = await rebuild([event('LoanCreated', { loanId: '1', borrower, principal: '100', collateralETH: '50', interestRateBps: '1200' })], { loanAt: { 1: loan() } });
  assert.deepEqual(Object.keys(loan()).sort(), Object.keys(Object.fromEntries(Object.keys(loan()).map((key) => [key, store.loans.get('1')[key]]))).sort());
});
test('EMIScheduleCreated writes header and canonical installments without recalculation', async () => {
  const schedule = [installment(), installment({ installmentId: '1', dueDate: '70', amount: '56' })]; const { store } = await rebuild([event('EMIScheduleCreated', { loanId: '1', totalInstallments: '2', emiAmount: '55' })], { scheduleAt: { 1: schedule } });
  assert.equal(store.schedules.get('1').totalInstallments, '2'); assert.equal(store.installments.get('1:1').amount, '56');
});
test('EMIPaid updates an existing installment from canonical schedule state', async () => {
  const events = [event('EMIScheduleCreated', { loanId: '1', totalInstallments: '1', emiAmount: '55' }, { block: 1 }), event('EMIPaid', { loanId: '1', installmentId: '0', payer: borrower, amount: '55' }, { block: 2, transaction: 2 })];
  const { store } = await rebuild(events, { scheduleAt: { 1: [installment()], 2: [installment({ paid: true, paidAt: '60' })] }, loanAt: { 2: loan({ totalRepaid: '55' }) } }); assert.equal(store.installments.get('1:0').paidAt, '60');
});
test('LoanRepaid plus EMIPaid and ABCD Transfer creates reconciled repayment', async () => {
  const events = [event('EMIScheduleCreated', { loanId: '1', totalInstallments: '1', emiAmount: '55' }, { block: 1 }), event('Transfer', { from: borrower, to: lender, value: '55' }, { block: 2, transaction: 2 }), event('LoanRepaid', { loanId: '1', borrower, amountRepaid: '55', newStatus: '0' }, { block: 2, transaction: 2, log: 1 }), event('EMIPaid', { loanId: '1', installmentId: '0', payer: borrower, amount: '55' }, { block: 2, transaction: 2, log: 2 })];
  const { store } = await rebuild(events, { scheduleAt: { 1: [installment()], 2: [installment({ paid: true, paidAt: '60' })] }, loanAt: { 2: loan({ totalRepaid: '55' }) } }); assert.equal(store.repayments.size, 1); assert.equal([...store.repayments.values()][0].lender, lender);
});
test('EMIDefaulted plus LoanDefaulted creates a default projection', async () => {
  const events = [event('LoanCreated', { loanId: '1', borrower, principal: '100', collateralETH: '50', interestRateBps: '1200' }), event('EMIScheduleCreated', { loanId: '1', totalInstallments: '1', emiAmount: '55' }, { block: 1, log: 1 }), event('LoanDefaulted', { loanId: '1', borrower }, { block: 2, transaction: 2 }), event('EMIDefaulted', { loanId: '1', installmentId: '0', dueDate: '40' }, { block: 2, transaction: 2, log: 1 })];
  const { store } = await rebuild(events, { loanAt: { 1: loan(), 2: loan({ status: 'DEFAULTED' }) }, scheduleAt: { 1: [installment()] } }); assert.equal(store.defaults.size, 1); assert.equal(store.loans.get('1').status, 'DEFAULTED');
});
test('liquidation requires LoanManager, marketplace, and vault evidence', async () => {
  const events = [event('LoanCreated', { loanId: '1', borrower, principal: '100', collateralETH: '50', interestRateBps: '1200' }), event('RequestCreated', { requestId: '1', borrower, principal: '100', collateralETH: '50' }), event('RequestFunded', { requestId: '1', lender, loanId: '1' }, { transaction: 2, log: 1 }), event('LoanDefaulted', { loanId: '1', borrower }, { block: 2 }), event('CollateralETHLiquidated', { liquidator: lender, amount: '50' }, { block: 3, transaction: 3 }), event('LoanLiquidated', { loanId: '1', borrower }, { block: 3, transaction: 3, log: 1 }), event('P2PLoanLiquidated', { loanId: '1', requestId: '1', lender, collateralETH: '50' }, { block: 3, transaction: 3, log: 2 })];
  const { store } = await rebuild(events, { loanAt: { 1: loan(), 2: loan({ status: 'DEFAULTED' }), 3: loan({ status: 'LIQUIDATED' }) }, requestAt: { 1: request(), 3: request({ lender, status: 'FUNDED' }) } }); assert.equal(store.liquidations.size, 1); assert.equal(store.loans.get('1').status, 'LIQUIDATED');
});
test('borrower-scoped collateral remains unattributed without same-transaction lifecycle evidence', async () => {
  const { store } = await rebuild([event('CollateralETHDeposited', { borrower, amount: '50' })]); assert.equal([...store.collateral.values()][0].attribution, 'UNATTRIBUTED');
});
test('duplicate raw events do not duplicate business projections', async () => {
  const item = event('RequestCreated', { requestId: '1', borrower, principal: '100', collateralETH: '50' }); const { store } = await rebuild([item, item], { requestAt: { 1: request() } }); assert.equal(store.requests.size, 1);
});
test('impossible loan transition is recorded instead of silently applied', async () => {
  const events = [event('LoanCreated', { loanId: '1', borrower, principal: '100', collateralETH: '50', interestRateBps: '1200' }), event('LoanRepaid', { loanId: '1', borrower, amountRepaid: '110', newStatus: '1' }, { block: 2 }), event('LoanDefaulted', { loanId: '1', borrower }, { block: 3 })];
  const { store } = await rebuild(events, { loanAt: { 1: loan(), 2: loan({ status: 'REPAID', totalRepaid: '110' }), 3: loan({ status: 'DEFAULTED', totalRepaid: '110' }) } }); assert.ok([...store.errors.values()].some((item) => item.code === 'IMPOSSIBLE_LOAN_STATE_TRANSITION')); assert.equal(store.loans.get('1').status, 'REPAID');
});
test('missing transfer evidence is recorded and does not create repayment', async () => {
  const events = [event('EMIScheduleCreated', { loanId: '1', totalInstallments: '1', emiAmount: '55' }), event('EMIPaid', { loanId: '1', installmentId: '0', payer: borrower, amount: '55' }, { block: 2, transaction: 2 })];
  const { store } = await rebuild(events, { scheduleAt: { 1: [installment()], 2: [installment({ paid: true, paidAt: '60' })] }, loanAt: { 2: loan() } }); assert.equal(store.repayments.size, 0); assert.ok([...store.errors.values()].some((item) => item.code === 'REPAYMENT_MISSING_REQUIRED_EVIDENCE'));
});
test('missing collateral evidence is recorded and does not create liquidation', async () => {
  const events = [event('P2PLoanLiquidated', { loanId: '1', requestId: '1', lender, collateralETH: '50' }, { transaction: 3 })]; const { store } = await rebuild(events, { loanAt: { 1: loan({ status: 'LIQUIDATED' }) } }); assert.equal(store.liquidations.size, 0); assert.ok([...store.errors.values()].some((item) => item.code === 'LIQUIDATION_MISSING_REQUIRED_EVIDENCE'));
});
test('full rebuild reads raw events and yields the same projection state repeatedly', async () => {
  const events = [event('RequestCreated', { requestId: '1', borrower, principal: '100', collateralETH: '50' })]; const subject = engine(events, { requestAt: { 1: request() } }); await subject.engine.rebuildLendingProjection({}); const first = subject.store.snapshot(); await subject.engine.rebuildLendingProjection({}); assert.equal(subject.store.snapshot(), first);
});
test('rebuild excludes removed/reorged raw events', async () => {
  const removed = { ...event('RequestCreated', { requestId: '1', borrower, principal: '100', collateralETH: '50' }), removed: true }; const subject = await rebuild([removed], { requestAt: { 1: request() } }); assert.equal(subject.store.requests.size, 0);
});
test('state transition history is append-only and records ACTIVE to DEFAULTED', async () => {
  const events = [event('LoanCreated', { loanId: '1', borrower, principal: '100', collateralETH: '50', interestRateBps: '1200' }), event('LoanDefaulted', { loanId: '1', borrower }, { block: 2, transaction: 2 })]; const { store } = await rebuild(events, { loanAt: { 1: loan(), 2: loan({ status: 'DEFAULTED' }) } }); assert.equal(store.transitions.size, 2); assert.ok([...store.transitions.values()].some((item) => item.fromStatus === 'ACTIVE' && item.toStatus === 'DEFAULTED'));
});
