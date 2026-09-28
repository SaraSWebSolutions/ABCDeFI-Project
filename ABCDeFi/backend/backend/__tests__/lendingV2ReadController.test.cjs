const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'modules', 'lendingV2Projection', 'lendingV2Read.controller.cjs'), 'utf8');
const routes = fs.readFileSync(path.resolve(__dirname, '..', 'modules', 'lendingV2Projection', 'lendingV2Read.routes.cjs'), 'utf8');
const {
  canonicalLendingV2Availability,
  isP2PRequestLifecycleEvent,
  loanJson,
  REFERRAL_NON_CLAIMABLE_CURRENT_STATE,
  REFERRAL_PAID,
  referralNonClaimableState,
  referralStatus,
} = require('../modules/lendingV2Projection/lendingV2Read.controller.cjs');
const { checkpointRuntimeFields } = require('../config/projectionRuntimeContext.cjs');

const ADDRESS = '0x0000000000000000000000000000000000000001';
const HASH = `0x${'a'.repeat(64)}`;
const identity = `0x${'b'.repeat(64)}`;

async function lendingAvailabilityDependencies({ checkpoint: checkpointOverride, latest = 84, manifest: manifestOverride } = {}) {
  const manifest = manifestOverride || {
    chainId: 31337,
    runtimeFamily: '1Q_LOCAL',
    rpcUrl: 'http://127.0.0.1:8546',
    deploymentIdentity: identity,
    deploymentVersion: 'lending-v2-1q-local-test',
    contracts: { LendingPoolV2: { address: ADDRESS } },
  };
  const provider = {
    getNetwork: async () => ({ chainId: 31337n }),
    getCode: async () => '0x6000',
    getBlock: async () => ({ hash: HASH }),
    getBlockNumber: async () => latest,
  };
  const runtime = await checkpointRuntimeFields(manifest, provider, [ADDRESS]);
  const checkpoint = checkpointOverride === undefined
    ? { chainId: '31337', deploymentVersion: manifest.deploymentVersion, runtimeFamily: '1Q_LOCAL', rpcUrl: manifest.rpcUrl, deploymentIdentity: manifest.deploymentIdentity, scope: 'canonical-lending-v2', ...runtime, lastProcessedBlock: '84', lastProcessedBlockHash: HASH }
    : checkpointOverride;
  return { manifest, provider, models: { V2BlockCheckpoint: { findOne: () => ({ lean: async () => checkpoint }) } } };
}

test('canonical Lending V2 availability shares a live, deployment-scoped checkpoint gate with Admin', async () => {
  const dependencies = await lendingAvailabilityDependencies();
  const result = await canonicalLendingV2Availability(dependencies);
  assert.deepEqual(result, { available: true, status: 'AVAILABLE', checkpoint: '84' });
});

test('canonical Lending V2 availability fails closed for missing, stale, mismatched, or legacy provenance', async () => {
  const missing = await lendingAvailabilityDependencies({ checkpoint: null });
  assert.equal((await canonicalLendingV2Availability(missing)).available, false);

  const stale = await lendingAvailabilityDependencies({ checkpoint: { lastProcessedBlock: '81', lastProcessedBlockHash: HASH }, latest: 84 });
  assert.match((await canonicalLendingV2Availability(stale)).reason, /checkpoint (does not match|is stale)/i);

  const mismatch = await lendingAvailabilityDependencies({ checkpoint: { lastProcessedBlock: '84', lastProcessedBlockHash: HASH, runtimeFamily: '1Q_LOCAL', rpcUrl: 'http://127.0.0.1:8546', deploymentIdentity: `0x${'c'.repeat(64)}`, contractRuntimeIdentity: `0x${'d'.repeat(64)}` } });
  assert.match((await canonicalLendingV2Availability(mismatch)).reason, /does not match/i);

  const legacy = await lendingAvailabilityDependencies({ manifest: { chainId: 31337, rpcUrl: 'http://127.0.0.1:8545', deploymentVersion: 'lending-v2-legacy', contracts: { LendingPoolV2: { address: ADDRESS } } } });
  assert.match((await canonicalLendingV2Availability(legacy)).reason, /explicit canonical 1Q_LOCAL/i);
});

test('V2 loan reads load the three completion-certificate role slots directly from LoanNFTV2', () => {
  assert.match(source, /nft\.loanCertificates\(loanId, role\)/);
  assert.match(source, /nft\.getCertificate\(certificateTokenId\)/);
  assert.match(source, /\['LENDER', 'BORROWER', 'PLATFORM'\]/);
});

test('V2 pending-position capacity is calculated from collateral, not the deposit ID', () => {
  assert.match(source, /pool\.maxBorrowable\(collateral\)/);
  assert.doesNotMatch(source, /pool\.maxBorrowable\(depositId\)/);
});

test('V2 API serializes named loan, request, certificate, and schedule fields', () => {
  for (const helper of ['loanJson', 'requestJson', 'certificateJson', 'scheduleJson']) {
    assert.match(source, new RegExp(`const ${helper}`));
  }
  assert.match(source, /initialLtvBps/);
  assert.match(source, /valuationFeed/);
  assert.match(source, /completionABCDUSDPrice/);
  assert.match(source, /amountApplied/);
  assert.match(source, /remainingDue/);
});

test('V2 API keeps immutable original collateral distinct from current vault collateral', () => {
  const serialized = loanJson({ collateralETH: 100000000000000000n }, 101000000000000000n);
  assert.equal(serialized.collateralETH, '100000000000000000');
  assert.equal(serialized.originalCollateralETH, '100000000000000000');
  assert.equal(serialized.currentVaultCollateralETH, '101000000000000000');
  assert.match(source, /vault\.loanCollateral\(loanId\)/);
  assert.match(source, /liquidation\.currentLtvBps\(loanId\)/);
  assert.match(source, /deploymentVersion: manifest\.deploymentVersion/);
});

test('V2 loan detail retains debt and EMI reads when a canonical risk quote is unavailable', () => {
  assert.match(source, /Do not let an unavailable risk/);
  assert.match(source, /let currentLtvBps = null; let healthFactor = null; let liquidatable = null; let riskError = null;/);
  assert.match(source, /riskError = error\?\.shortMessage/);
  assert.match(source, /previews: \{ accruedInterest, outstanding, totalRepayment, state, currentLtvBps, healthFactor, liquidatable, riskError/);
  assert.doesNotMatch(source, /previewLateFee/);
  assert.doesNotMatch(source, /lateFeeAssessed/);
});

test('V2 terminal zero-debt reads do not present the liquidation divide-by-zero sentinel as LTV', () => {
  assert.match(source, /if \(outstanding !== 0n\) \{/);
  assert.match(source, /Terminal zero-debt loans have no risk position/);
});

test('V2 API never fabricates a liquidation quote and exposes execution only from the canonical adapter configuration', () => {
  assert.match(source, /marketplace\.requestByLoanId\(loanId\)/);
  assert.doesNotMatch(source, /liquidation\.previewLiquidation\(loanId\)/);
  assert.doesNotMatch(source, /liquidation\.previewP2PPartialLiquidation\(loanId\)/);
  assert.match(source, /let partialLiquidationExecution = 'NOT_CONFIGURED'/);
  assert.match(source, /liquidation\.saleAdapter\(\)/);
  assert.match(source, /adapter\.configured\(\)/);
});

test('V2 lending referral reads use canonical referral events and live LendingReferralManagerV2 state, never the legacy ICO manager', () => {
  assert.match(source, /new Contract\(manifest\.contracts\.LendingReferralManagerV2\.address, artifacts\.LendingReferralManagerV2\.abi, provider\)/);
  assert.match(source, /eventList\(\{ contractName: 'LendingReferralManagerV2' \}, 1_000\)/);
  assert.match(source, /referral\.getLoanReferral\(loanId, referred\)/);
  assert.match(source, /referral\.getReferralCertificate\(tokenId\)/);
  assert.match(source, /referral\.ownerOf\(tokenId\)/);
  assert.match(source, /referral\.tokenURI\(tokenId\)/);
  assert.match(source, /claimableAmount/);
  assert.match(routes, /router\.get\('\/referrals\/:address', controller\.referral\)/);
  assert.doesNotMatch(source, /ReferralManager\.sol/);
});

test('V2 referral reads keep RESIDUAL_DEBT neutral and non-claimable', () => {
  assert.equal(referralNonClaimableState(7), true);
  assert.equal(referralStatus(7, true), REFERRAL_NON_CLAIMABLE_CURRENT_STATE);
  assert.notEqual(referralStatus(7, true), 'CLAIMABLE');
  assert.notEqual(referralStatus(7, true), 'ACCRUING_OR_AWAITING_PAYOUT');
  assert.match(source, /const claimable = !nonClaimableState/);
});

test('V2 referral reads distinguish an unpaid aggregate from a recorded aggregate reward payment', () => {
  assert.equal(referralStatus(5, false, 0n), 'ACCRUING_OR_AWAITING_PAYOUT');
  assert.equal(referralStatus(5, false, 17_500_000_000_000_000n), REFERRAL_PAID);
  assert.equal(referralStatus(3, false, 17_500_000_000_000_000n), 'STOPPED');
  assert.equal(referralStatus(4, false, 17_500_000_000_000_000n), 'STOPPED');
  assert.equal(referralStatus(7, false, 17_500_000_000_000_000n), REFERRAL_NON_CLAIMABLE_CURRENT_STATE);
  assert.match(source, /status: referralStatus\(Number\(effectiveState\), claimable, record\.totalRewards\)/);
});

test('V2 reserve API reads its balance from InsuranceReserveV2 and returns indexed audit evidence separately', () => {
  assert.match(source, /reserve\.availableBalance\(\)/);
  assert.match(source, /reserve\.reserveCoverCapABCD\(\)/);
  assert.match(source, /contractName: 'InsuranceReserveV2', eventName: 'ReserveFunded'/);
  assert.match(source, /contractName: 'InsuranceReserveV2', eventName: 'ReserveUsed'/);
  assert.match(source, /contractName: 'InsuranceReserveV2', eventName: 'ReserveBalanceUpdated'/);
});

test('V2 history is deployment-version-scoped, numerically ordered, and cursor-paginated without synthetic records', () => {
  assert.match(source, /const eventTuple = \(event\) => \[BigInt\(event\.blockNumber\), Number\(event\.transactionIndex\), Number\(event\.logIndex\)\]/);
  assert.match(source, /const compareEvents/);
  assert.match(source, /const encodeCursor/);
  assert.match(source, /const decodeCursor/);
  assert.match(source, /const eventPage/);
  assert.match(source, /page: \{ limit: boundedLimit\(req\.query\.limit\), nextCursor: page\.nextCursor \}/);
  assert.doesNotMatch(source, /sort\(\{ blockNumber: 1, logIndex: 1 \}\)/);
});

test('P2P request history is limited to canonical LoanMarketplaceV2 lifecycle events for the requested ID', () => {
  const directCollision = { contractName: 'CollateralVaultV2', eventName: 'CollateralLocked', args: { requestId: '1' }, blockNumber: '80', transactionIndex: 0, logIndex: 7 };
  const created = { contractName: 'LoanMarketplaceV2', eventName: 'RequestCreated', args: { requestId: '1' }, blockNumber: '104', transactionIndex: 0, logIndex: 3 };
  const funded = { contractName: 'LoanMarketplaceV2', eventName: 'RequestFunded', args: { requestId: '1', loanId: '4' }, blockNumber: '106', transactionIndex: 0, logIndex: 4 };
  const otherRequest = { contractName: 'LoanMarketplaceV2', eventName: 'RequestCreated', args: { requestId: '2' }, blockNumber: '105', transactionIndex: 0, logIndex: 1 };
  const unrelatedMarketEvent = { contractName: 'LoanMarketplaceV2', eventName: 'Paused', args: { requestId: '1' }, blockNumber: '107', transactionIndex: 0, logIndex: 0 };
  const history = [funded, directCollision, unrelatedMarketEvent, created, otherRequest]
    .filter((event) => isP2PRequestLifecycleEvent(event, '1'))
    .sort((left, right) => Number(left.blockNumber) - Number(right.blockNumber) || left.transactionIndex - right.transactionIndex || left.logIndex - right.logIndex);
  assert.deepEqual(history, [created, funded]);
  assert.equal(isP2PRequestLifecycleEvent(directCollision, '1'), false);
  assert.equal(isP2PRequestLifecycleEvent(otherRequest, '1'), false);
  assert.equal(isP2PRequestLifecycleEvent(unrelatedMarketEvent, '1'), false);
  assert.match(source, /const page = await eventPage\(projectionRuntimeFields\(manifest\), limit, decodeCursor\(req\.query\.cursor, manifest\.deploymentVersion\), \(event\) => isP2PRequestLifecycleEvent\(event, id\)\)/);
  assert.match(source, /page: \{ limit, nextCursor: page\.nextCursor \}/);
});

test('LoanNFTV2 certificate reads are deployment-scoped indexed-event projections with live contract ownership and no legacy source', () => {
  assert.match(source, /contractName: 'LoanNFTV2', eventName: 'LoanCertificateCreated'/);
  assert.match(source, /nft\.ownerOf\(tokenId\)/);
  assert.match(source, /nft\.tokenURI\(tokenId\)/);
  assert.match(source, /nft\.getCertificate\(tokenId\)/);
  assert.match(source, /certificate\.loanId.*creation\.args\.loanId/);
  assert.match(source, /canonical certificate projection/);
  assert.doesNotMatch(source, /modules\/lendingProjection/);
  assert.doesNotMatch(source, /MOCK_LOAN_NFT_TRIPLES/);
});

test('LoanNFTV2 certificate API exposes deterministic paginated token, loan, wallet, provenance, and Transfer history reads', () => {
  for (const route of [
    "router.get('/certificates/wallet/:address', controller.walletCertificates)",
    "router.get('/certificates/loans/:loanId', controller.loanCertificates)",
    "router.get('/certificates/:tokenId/history', controller.certificateHistory)",
    "router.get('/certificates/:tokenId', controller.certificate)",
  ]) assert.match(routes, new RegExp(route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /event\.eventName === 'Transfer'/);
  assert.match(source, /LoanCertificateValuationRecorded/);
  assert.match(source, /decodeCursor\(req\.query\.cursor, manifest\.deploymentVersion\)/);
  assert.match(source, /lower\(certificate\.owner\) === wallet/);
  assert.match(source, /if \(!state\) return;/);
});
