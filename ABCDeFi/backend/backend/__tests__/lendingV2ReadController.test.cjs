const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'modules', 'lendingV2Projection', 'lendingV2Read.controller.cjs'), 'utf8');
const routes = fs.readFileSync(path.resolve(__dirname, '..', 'modules', 'lendingV2Projection', 'lendingV2Read.routes.cjs'), 'utf8');
const { loanJson } = require('../modules/lendingV2Projection/lendingV2Read.controller.cjs');

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
