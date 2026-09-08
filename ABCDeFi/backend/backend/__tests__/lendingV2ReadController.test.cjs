const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'modules', 'lendingV2Projection', 'lendingV2Read.controller.cjs'), 'utf8');

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
});

test('V2 reserve API reads its balance from InsuranceReserveV2 and returns indexed audit evidence separately', () => {
  assert.match(source, /reserve\.availableBalance\(\)/);
  assert.match(source, /contractName: 'InsuranceReserveV2', eventName: 'ReserveFunded'/);
  assert.match(source, /contractName: 'InsuranceReserveV2', eventName: 'ReserveUsed'/);
  assert.match(source, /contractName: 'InsuranceReserveV2', eventName: 'ReserveBalanceUpdated'/);
});
