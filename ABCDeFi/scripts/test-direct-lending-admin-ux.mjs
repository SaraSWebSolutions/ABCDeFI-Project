import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [component, service, dashboard, adminService, lendingController] = await Promise.all([
  readFile('src/components/CanonicalDirectLendingAdmin.tsx', 'utf8'),
  readFile('src/Services/lendingV2.ts', 'utf8'),
  readFile('src/components/CanonicalAdminDashboard.tsx', 'utf8'),
  readFile('src/Services/canonicalAdmin.ts', 'utf8'),
  readFile('backend/backend/modules/lendingV2Projection/lendingV2Read.controller.cjs', 'utf8'),
]);

// The panel is Direct-only and starts from deployment-scoped canonical API
// evidence, not from wallet-local or generic event discovery.
assert.match(component, /Canonical Direct Lending drill-down/);
assert.match(component, /getV2CanonicalDirectLoan/);
assert.match(component, /getV2CanonicalDirectLoanHistory/);
assert.match(component, /getV2ProtocolState/);
assert.match(component, /Direct loan lifecycle history/);
assert.match(component, /Canonical Lending V2 provenance/);
assert.match(component, /checkpoint block hash:/);
assert.match(component, /Canonical oracle\/risk read unavailable/);
assert.match(component, /LoanNFT completion evidence/);
assert.match(component, /Available pool liquidity:/);
assert.match(component, /Term: \{termDays/);
assert.match(component, /CollateralVaultV2/);
assert.match(component, /LiquidationV2/);

// A genuinely active/outstanding loan selects its canonical current schedule,
// while a terminal zero-debt loan cannot render a positive payable amount.
assert.match(component, /BigInt\(loan\.previews\.outstanding\) === 0n/);
assert.match(component, /\['3', '4', '5'\]\.includes\(loan\.loan\.state\)/);
assert.match(component, /Current installment: Not applicable — loan closed/);
assert.match(component, /Remaining due: 0 ABCD/);
assert.match(component, /Current payment status: No outstanding installment/);
assert.match(component, /Closed — no outstanding installment/);
assert.match(component, /\['Due', 'Partially settled', 'Settled'\]/);
assert.doesNotMatch(component, /\{currentInstallment\.state\}/);
assert.doesNotMatch(component, /\{item\.state\}<\/p>/);

// Direct client validation rejects P2P data and requires the exact canonical
// Lending child-manifest source-contract set, deployment version, checkpoint,
// and live read context. ABCDTokenV2 remains a root-manifest dependency and is
// independently live-bytecode-checked by assertV2Read(), rather than being
// incorrectly required in the API's child-manifest `source.contracts` object.
assert.match(service, /export async function getV2CanonicalDirectLoan/);
assert.match(service, /\/api\/lending-v2\/loans\/\$\{loanId\}/);
assert.match(service, /canonical-v2-indexed-on-chain/);
assert.match(service, /const childContracts = oneQRuntime\.children\.lending\.contracts/);
assert.match(service, /OracleAdapterV2: LENDING_V2_CONTRACTS\.oracle/);
assert.match(service, /LendingPoolV2: LENDING_V2_CONTRACTS\.pool/);
assert.match(service, /LendingReferralManagerV2', 'LiquidationSaleAdapterV2/);
assert.match(service, /Object\.keys\(contracts!\)\.length === Object\.keys\(expectedContracts\)\.length/);
assert.match(service, /Object\.entries\(expectedContracts\)\.every/);
assert.match(service, /excludes ABCDTokenV2/);
assert.match(service, /assertV2Read\(\)/);
assert.match(service, /data\.loan\?\.isP2P/);
assert.match(service, /Canonical Direct Lending loan evidence is unavailable or does not match the active Lending V2 deployment/);
assert.match(service, /getV2CanonicalDirectLoanHistory/);
assert.match(service, /Canonical Direct Lending history is unavailable for the active Lending V2 deployment/);
assert.match(service, /checkpointBlockHash/);
assert.match(service, /ONE_Q_RUNTIME_FAMILY !== '1Q_LOCAL'/);
assert.match(service, /const canonicalLendingVersion = oneQRuntime\.children\.lending\.deploymentVersion/);
assert.match(service, /const validRootIdentity = typeof oneQRuntime\.manifest\.deploymentIdentity === 'string'/);
assert.match(service, /source\.deploymentVersion !== canonicalLendingVersion/);
assert.doesNotMatch(service, /oneQRuntime\.manifest\.deploymentIdentity !== oneQRuntime\.children\.lending\.deploymentIdentity/);
// The Direct client relies on the same canonical availability gate as every
// Lending API response: explicit runtime, live bytecode, checkpoint hash,
// deployment context, and freshness all fail closed before data is returned.
assert.match(lendingController, /manifest\.runtimeFamily !== '1Q_LOCAL'/);
assert.match(lendingController, /provider\.getCode\(contract\.address\) === '0x'/);
assert.match(lendingController, /checkpointRuntimeMatches\(checkpoint, runtime\)/);
assert.match(lendingController, /lastProcessedBlockHash/);
assert.match(lendingController, /canonical Lending V2 indexer checkpoint is stale/);

// The dedicated Admin surface has no signer, wallet, emergency, or lending
// transaction capability. Shared EMI emergency control remains outside it.
for (const forbidden of ['useWallet', 'useAuth', 'getSigner', 'depositV2Collateral', 'borrowV2', 'repayV2', 'repayAllV2', 'payV2Emi', 'withdrawV2Collateral', 'addV2LoanCollateral', 'liquidateV2', 'executeV2OverdueEmi', 'pause(', 'unpause(', 'executeEmergencyPauseAction']) {
  assert.doesNotMatch(component, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(dashboard, /CanonicalDirectLendingAdmin/);
assert.match(dashboard, /module\.name === 'Lending V2' && module\.available/);
assert.match(adminService, /EMIManagerV2: \{ contract: 'EMIManagerV2', pauseRole: 'DEFAULT_ADMIN_ROLE', unpauseRole: 'DEFAULT_ADMIN_ROLE' \}/);
console.log('Canonical Direct Lending Admin read-only UX: PASS');
