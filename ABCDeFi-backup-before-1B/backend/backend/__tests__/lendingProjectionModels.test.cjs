const test = require('node:test');
const assert = require('node:assert/strict');

const models = require('../modules/lendingProjection');

const expectedCollections = {
  Deployment: 'deployments',
  ChainEvent: 'chain_events',
  BlockCheckpoint: 'block_checkpoints',
  LoanRequest: 'loan_requests',
  Loan: 'loans',
  EMISchedule: 'emi_schedules',
  EMIInstallment: 'emi_installments',
  Repayment: 'repayments',
  LoanDefault: 'loan_defaults',
  Liquidation: 'liquidations',
  DirectLendingPosition: 'direct_lending_positions',
  DirectLendingActivity: 'direct_lending_activities',
  DirectLiquidation: 'direct_liquidations',
  LoanNFTCertificate: 'loan_nft_certificates',
  LoanNFTTransfer: 'loan_nft_transfers',
  CollateralMovement: 'collateral_movements',
  LoanStateTransition: 'loan_state_transitions',
  ReconciliationError: 'lending_reconciliation_errors',
};

function hasIndex(model, fields, unique = false) {
  return model.schema.indexes().some(([index, options]) =>
    Object.entries(fields).every(([key, value]) => index[key] === value) && (!unique || options.unique === true)
  );
}

test('defines all canonical Lending/P2P projection collections', () => {
  for (const [name, collection] of Object.entries(expectedCollections)) {
    assert.equal(models[name].collection.name, collection, name);
  }
});

test('uses canonical chain identities as unique idempotency keys', () => {
  assert.ok(hasIndex(models.ChainEvent, { chainId: 1, transactionHash: 1, logIndex: 1 }, true));
  assert.ok(hasIndex(models.LoanRequest, { chainId: 1, loanMarketplaceAddress: 1, requestId: 1 }, true));
  assert.ok(hasIndex(models.Loan, { chainId: 1, loanManagerAddress: 1, loanId: 1 }, true));
  assert.ok(hasIndex(models.EMIInstallment, { chainId: 1, emiManagerAddress: 1, loanId: 1, installmentId: 1 }, true));
  assert.ok(hasIndex(models.DirectLendingPosition, { chainId: 1, lendingPoolAddress: 1, borrower: 1 }, true));
  assert.ok(hasIndex(models.DirectLendingActivity, { chainId: 1, 'evidence.transactionHash': 1, 'evidence.logIndex': 1 }, true));
  assert.ok(hasIndex(models.LoanNFTCertificate, { chainId: 1, loanNFTAddress: 1, tokenId: 1 }, true));
});

test('preserves uint256 precision and stores required repayment evidence', () => {
  assert.equal(models.Loan.schema.path('principal').instance, 'String');
  assert.equal(models.Loan.schema.path('totalRepaid').instance, 'String');
  assert.equal(models.EMIInstallment.schema.path('amount').instance, 'String');
  assert.equal(models.Repayment.schema.path('amount').instance, 'String');
  assert.ok(models.Repayment.schema.path('emiEvidence').isRequired);
  assert.ok(models.Repayment.schema.path('loanRepaymentEvidence').isRequired);
  assert.ok(models.Repayment.schema.path('tokenTransferEvidence').isRequired);
  assert.ok(models.Repayment.schema.path('lenderDerivation.source').isRequired);
});

test('keeps collateral movements independently attributable', () => {
  assert.equal(models.CollateralMovement.schema.path('requestId').options.default, null);
  assert.equal(models.CollateralMovement.schema.path('loanId').options.default, null);
  assert.ok(models.CollateralMovement.schema.path('attribution').enumValues.includes('UNATTRIBUTED'));
  assert.ok(models.LoanStateTransition.schema.path('evidence').isRequired);
});
