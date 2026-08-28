const test = require('node:test');
const assert = require('node:assert/strict');

const { loadLendingManifest } = require('../config/lendingManifest.cjs');
const { createLendingReadController, normalizeWalletAddress } = require('../modules/lendingProjection/lendingRead.controller');
const { DEFAULT_SCOPE } = require('../modules/lendingProjection/indexer');

const manifest = loadLendingManifest();
const wallet = '0x0000000000000000000000000000000000000001';

function query(value) {
  return { sort() { return this; }, limit() { return this; }, lean: async () => value };
}
function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}
function models({ available = true, openRequests = [], directActivities = [] } = {}) {
  const deployment = available ? { chainId: String(manifest.chainId), deploymentVersion: manifest.deploymentVersion } : null;
  const checkpoint = available ? { contractScope: DEFAULT_SCOPE, lastProcessedBlock: '19' } : null;
  const emptyFind = () => query([]);
  const emptyOne = () => query(null);
  return {
    Deployment: { findOne: () => query(deployment) },
    BlockCheckpoint: { findOne: () => query(checkpoint) },
    LoanRequest: { find: () => query(openRequests), findOne: emptyOne },
    Loan: { find: emptyFind, findOne: emptyOne }, EMISchedule: { findOne: emptyOne }, EMIInstallment: { find: emptyFind },
    Repayment: { find: emptyFind }, LoanDefault: { find: emptyFind, findOne: emptyOne }, Liquidation: { find: emptyFind, findOne: emptyOne },
    DirectLendingPosition: { findOne: emptyOne }, DirectLendingActivity: { find: () => query(directActivities) }, DirectLiquidation: { find: emptyFind }, LoanNFTCertificate: { find: emptyFind }, LoanStateTransition: { find: emptyFind },
  };
}

test('returns explicit UNAVAILABLE rather than an empty open-request list before the canonical indexer syncs', async () => {
  const controller = createLendingReadController({ models: models({ available: false }), manifest });
  const res = response(); await controller.openRequests({ query: {} }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 200); assert.equal(res.body.status, 'UNAVAILABLE'); assert.deepEqual(res.body.data, []);
});

test('returns canonical open P2P projections after the indexer checkpoint exists', async () => {
  const request = { requestId: '1', borrower: wallet, lender: null, status: 'OPEN', principal: '100', collateralETH: '50' };
  const controller = createLendingReadController({ models: models({ openRequests: [request] }), manifest });
  const res = response(); await controller.openRequests({ query: { limit: '5' } }, res, (error) => { throw error; });
  assert.equal(res.body.status, 'AVAILABLE'); assert.equal(res.body.source.kind, 'canonical-indexed-on-chain'); assert.deepEqual(res.body.data, [request]);
});

test('accepts lowercase and checksummed wallet path parameters and normalizes them for canonical database queries', async () => {
  const lowercase = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266';
  const checksummed = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
  assert.equal(normalizeWalletAddress(lowercase), lowercase);
  assert.equal(normalizeWalletAddress(checksummed), lowercase);
  for (const address of [lowercase, checksummed]) {
    const controller = createLendingReadController({ models: models(), manifest });
    const res = response(); await controller.walletHistory({ params: { address }, query: {} }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 200); assert.equal(res.body.status, 'AVAILABLE'); assert.equal(res.body.wallet, lowercase);
  }
});

test('rejects an invalid wallet path parameter instead of querying indexed data', async () => {
  const controller = createLendingReadController({ models: models(), manifest });
  const res = response(); await controller.walletHistory({ params: { address: 'not-an-address' }, query: {} }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 400); assert.equal(res.body.status, 'INVALID_REQUEST');
  assert.equal(normalizeWalletAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92267'), null);
});

test('returns direct LendingPool history only from canonical indexed event records', async () => {
  const directActivity = { borrower: wallet, action: 'BORROW', asset: 'ABCD', amount: '100', evidence: { blockNumber: '19', transactionIndex: 0, logIndex: 1 } };
  const controller = createLendingReadController({ models: models({ directActivities: [directActivity] }), manifest });
  const res = response(); await controller.walletHistory({ params: { address: wallet }, query: {} }, res, (error) => { throw error; });
  assert.equal(res.body.status, 'AVAILABLE');
  assert.deepEqual(res.body.data.directLending.activities, [directActivity]);
});

test('validates the canonical loan-detail and loan-history resource IDs without creating a synthetic loan', async () => {
  const controller = createLendingReadController({ models: models(), manifest });
  for (const action of [controller.loanDetail, controller.loanHistory]) {
    const res = response(); await action({ params: { loanId: 'invalid' }, query: {} }, res, (error) => { throw error; });
    assert.equal(res.statusCode, 400); assert.equal(res.body.status, 'INVALID_REQUEST');
  }
  const res = response(); await controller.loanHistory({ params: { loanId: '1' }, query: {} }, res, (error) => { throw error; });
  assert.equal(res.statusCode, 404); assert.equal(res.body.status, 'NOT_FOUND');
});
