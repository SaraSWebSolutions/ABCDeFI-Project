import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [component, service, dashboard] = await Promise.all([
  readFile('src/components/CanonicalP2PAdmin.tsx', 'utf8'),
  readFile('src/Services/lendingV2.ts', 'utf8'),
  readFile('src/components/CanonicalAdminDashboard.tsx', 'utf8'),
]);

// The Admin drill-down starts from the canonical P2P endpoint and retains the
// API's deployment-scoped request history, rather than reconstructing events.
assert.match(component, /Canonical P2P drill-down/);
assert.match(component, /getV2P2PRequestHistory/);
assert.match(component, /getV2CanonicalP2PLoan/);
assert.match(component, /P2P request lifecycle timeline/);
assert.match(component, /Load next canonical page/);
assert.match(component, /Direct Lending events are excluded even when numeric IDs collide/);
assert.match(component, /Canonical Lending V2 provenance/);
assert.match(component, /EMI schedule and current due state/);
assert.match(component, /terminalWithoutDebt/);
assert.match(component, /BigInt\(loan\.previews\.outstanding\) === 0n/);
assert.match(component, /\['3', '4', '5'\]\.includes\(loan\.loan\.state\)/);
assert.match(component, /Current installment: Not applicable — loan closed/);
assert.match(component, /Remaining due: 0 ABCD/);
assert.match(component, /Current payment status: No outstanding installment/);
assert.match(component, /Closed — no outstanding installment/);
assert.match(component, /\['Due', 'Partially settled', 'Settled'\]/);
assert.doesNotMatch(component, /\{currentInstallment\.state\}/);
assert.doesNotMatch(component, /\{item\.state\}<\/p>/);
assert.match(component, /Canonical risk\/oracle read unavailable/);
assert.match(component, /LoanNFT completion evidence/);
assert.match(component, /Metadata hash:/);
assert.match(component, /current vault collateral/);
assert.match(component, /Liquidation eligibility:/);
assert.match(component, /Unavailable:/);
assert.match(component, /RequestCreated.*RequestFunded.*RequestCancelled.*RequestRepaid.*RequestRecovered/s);

// The typed service validates the same API provenance expected by the active
// manifest and rejects a non-P2P loan or mismatched source contracts.
assert.match(service, /export async function getV2CanonicalP2PLoan/);
assert.match(service, /\/api\/lending-v2\/loans\/\$\{loanId\}/);
assert.match(service, /canonical-v2-indexed-on-chain/);
assert.match(service, /LoanMarketplaceV2: LENDING_V2_CONTRACTS\.marketplace/);
assert.match(service, /!data\?\.loan\?\.isP2P/);
assert.match(service, /Canonical P2P loan evidence is unavailable or does not match the active Lending V2 deployment/);
assert.match(service, /p2pRequestLifecycleEvents/);
assert.match(service, /RequestCreated', 'RequestFunded', 'RequestCancelled', 'RequestRepaid', 'RequestRecovered/);

// Read-only boundary: no connected signer, write helpers, or P2P state
// changing controls may be available from the dedicated Admin component.
for (const forbidden of ['useWallet', 'useAuth', 'getSigner', 'createV2Request', 'fundV2Request', 'payV2Emi', 'payV2OutstandingEmi', 'liquidateV2', 'executeV2OverdueEmi', 'cancelRequest', 'markLoanRepaid', 'markLoanRecovered', 'pause(', 'unpause(']) {
  assert.doesNotMatch(component, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}
assert.match(dashboard, /CanonicalP2PAdmin/);
assert.match(dashboard, /module\.name === 'P2P' && module\.available/);
console.log('Canonical P2P Admin read-only UX: PASS');
