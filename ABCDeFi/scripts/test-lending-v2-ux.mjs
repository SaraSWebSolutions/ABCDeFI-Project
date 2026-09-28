import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ethers from 'ethers';

// The browser runtime refuses implicit deployment selection. This isolated
// renderer therefore supplies the same explicit 1Q selection as Vite.
process.env.VITE_ABCDEFI_RUNTIME_FAMILY = '1Q_LOCAL';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
// Mirror Vite's explicit 1Q manifest aliases for this Node-only renderer.
// It never falls back to a historical manifest or substitutes mock contracts.
const selectedManifest = path.resolve(root, process.env.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH || '.e2e-runtime/oneq-persistence-v1/manifests/unified.json');
if (!fs.existsSync(selectedManifest)) throw new Error(`Canonical 1Q manifest is unavailable for Lending UX tests: ${selectedManifest}`);
process.env.VITE_ABCDEFI_1Q_UNIFIED_MANIFEST_PATH = path.relative(root, selectedManifest).replace(/\\/g, '/');
const unifiedManifest = JSON.parse(fs.readFileSync(selectedManifest, 'utf8'));
const childManifest = name => {
  const entry = unifiedManifest.childManifests?.[name];
  if (!entry?.path) throw new Error(`Canonical 1Q ${name} manifest is unavailable for Lending UX tests.`);
  return require(entry.path);
};
const manifestAliases = {
  '@abcdefi/oneq-unified-manifest': unifiedManifest,
  '@abcdefi/oneq-root-manifest': childManifest('root'),
  '@abcdefi/oneq-ico-manifest': childManifest('ico'),
  '@abcdefi/oneq-lending-manifest': childManifest('lending'),
  '@abcdefi/oneq-legion-manifest': childManifest('legion'),
  '@abcdefi/oneq-franchise-manifest': childManifest('franchise'),
  '@abcdefi/oneq-marketplace10A-manifest': childManifest('marketplace10A'),
  '@abcdefi/oneq-marketplace10B-manifest': childManifest('marketplace10B'),
};
function load(relative, overrides = {}, expose = '') {
  const absolute = path.resolve(root, relative);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8') + expose, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = spec => {
    if (Object.hasOwn(overrides, spec)) return overrides[spec];
    if (Object.hasOwn(manifestAliases, spec)) return manifestAliases[spec];
    if (!spec.startsWith('.')) return require(spec);
    const base = path.resolve(path.dirname(absolute), spec);
    if (base.endsWith('.json')) return require(base);
    const file = ['.ts', '.tsx', '.js', '.mjs', ''].map(ext => base + ext).find(file => fs.existsSync(file));
    return load(path.relative(root, file), overrides);
  };
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports);
  return module.exports;
}
const flow = load('src/Utils/lendingV2Flow.ts');
const present = load('src/components/lendingV2/LendingV2Presentation.tsx');
const borrower = '0x1111111111111111111111111111111111111111';
const other = '0x2222222222222222222222222222222222222222';
const poolAddress = '0x3333333333333333333333333333333333333333';
const vaultAddress = '0x4444444444444444444444444444444444444444';
// Fixtures below are confined to tests; production never imports them.
const deposit = { depositId: '27', collateralETH: '0.1', collateralUSD: '200', maxBorrowable: '70', borrower, active: true };
const input = { deposit, depositId: '27', address: borrower, connected: true, correctNetwork: true, loading: false, error: null, principal: '70', term: '30' };
const baseLoan = { state: 0, borrower, outstanding: '70', collateralETH: '0.1', liquidatable: false };
const stage = overrides => flow.directStage({ loan: null, deposit: null, capacityLoading: false, operation: null, depositConfirmed: false, ...overrides });
const component = load('src/components/LendingV2.tsx', {
  '../Services/lendingV2': {},
  '../Config/contracts': { getLendingV2Contracts: () => ({ pool: poolAddress }), getLendingV2DeploymentBlock: () => 1 },
  '../Context/WalletContext': { useWallet: () => ({ address: null, isConnected: false, isCorrectNetwork: false, refreshBalances: async () => {} }) },
});

test('V2 borrow validation accepts only owned active current deposits and authoritative limits', () => {
  assert.equal(flow.borrowBlocker(input), null);
  for (const change of [
    { connected: false }, { correctNetwork: false }, { address: other }, { loading: true }, { error: 'RPC error' },
    { depositId: '28' }, { deposit: { ...deposit, active: false } }, { deposit: { ...deposit, maxBorrowable: '0' } },
    { principal: '0' }, { principal: '100.000000000000000001' }, { principal: '1.0000000000000000001' },
    { term: '60' },
  ]) assert.ok(flow.borrowBlocker({ ...input, ...change }), JSON.stringify(change));
  assert.equal(flow.borrowBlocker({ ...input, principal: '250', deposit: { ...deposit, maxBorrowable: '250' }, term: '90' }), null);
  assert.equal(flow.borrowBlocker({ ...input, term: '180' }), null);
});

test('terminal repayment selects the completion path even when equivalent decimal strings differ', () => {
  assert.equal(flow.sameAmount('70', '70.0'), true);
  assert.equal(flow.sameAmount('70.000000000000000001', '70'), false);
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(source, /sameAmount\(repayment, loan!\.outstanding\)/);
  assert.match(source, /payV2OutstandingEmi\(p2pLoanId, p2pPayment, prepareCompletionMetadata, progress\)/);
});

test('Direct Lending UI and service do not expose a removed crypto late-fee charge', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Direct late fee|Late fee|including fees/);
  assert.doesNotMatch(service, /previewLateFee|LATE_FEE_BPS|lateFeeBps|lateFee/);
});

test('Direct Lending displays the canonical partial-sale execution read without treating local configuration as production policy', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(service, /partialLiquidationExecution = saleAdapter === ZeroAddress/);
  assert.match(source, /p\.partialLiquidationExecution === 'CONFIGURED'/);
  assert.match(source, /Configured — local test-only; not production policy/);
  assert.match(source, /Not configured — fail closed/);
  assert.doesNotMatch(source, /label="Partial-sale execution" value="Not configured — fail closed"/);
});

test('terminal zero-debt V2 reads do not show a contract risk sentinel as an active LTV', () => {
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(service, /if \(outstanding !== 0n\) \{/);
  assert.match(service, /risk = \{ ltvBps: ltvBps\.toString\(\)/);
});

test('Lending referral controls use only the canonical V2 manager and aggregate payout method', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingReferralV2.ts', import.meta.url), 'utf8');
  assert.match(source, /Lending referral relationship/);
  assert.match(source, /createLendingReferralCode/);
  assert.match(source, /bindLendingReferrer/);
  assert.match(source, /claimLendingAccruedReward/);
  assert.match(service, /LendingReferralManagerV2/);
  assert.match(service, /claimAccruedReward/);
  assert.doesNotMatch(service, /claimMonthlyReward/);
  assert.doesNotMatch(service, /ReferralManager\.sol/);
});

test('top-level dashboard referrals render the canonical Lending V2 referral experience, not the legacy presale referral UI', () => {
  const dashboard = fs.readFileSync(new URL('../src/components/UserDashboard.tsx', import.meta.url), 'utf8');
  const referralDashboard = fs.readFileSync(new URL('../src/components/LendingReferralDashboard.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingReferralV2.ts', import.meta.url), 'utf8');
  assert.match(dashboard, /import \{ LendingReferralDashboard \} from '\.\/LendingReferralDashboard';/);
  assert.match(dashboard, /activeTab === 'referral' && <LendingReferralDashboard \/>/);
  assert.doesNotMatch(dashboard, /import \{ ReferralSystem \} from '\.\/ReferralSystem';/);
  assert.match(referralDashboard, /LendingReferralPanel/);
  assert.match(referralDashboard, /Indexed lending referral projection/);
  assert.match(service, /\/api\/lending-v2\/referrals\//);
  assert.doesNotMatch(referralDashboard, /contracts\/ico\/ReferralManager/);
});

test('Lending referral dashboard renders the neutral non-claimable residual-debt status', () => {
  const referralDashboard = fs.readFileSync(new URL('../src/components/LendingReferralDashboard.tsx', import.meta.url), 'utf8');
  assert.match(referralDashboard, /NON_CLAIMABLE_CURRENT_STATE/);
  assert.match(referralDashboard, /Not claimable in current loan state/);
  assert.match(referralDashboard, /value=\{referralStatusLabel\(record\.status\)\}/);
});

test('Lending referral dashboard renders a recorded aggregate reward payment accurately', () => {
  const referralDashboard = fs.readFileSync(new URL('../src/components/LendingReferralDashboard.tsx', import.meta.url), 'utf8');
  assert.match(referralDashboard, /status === 'PAID'/);
  assert.match(referralDashboard, /Reward paid/);
  assert.match(referralDashboard, /Claimable aggregate amount/);
});

test('V2 borrow controls stay rendered during loading and empty states', () => {
  for (const blocker of [null, 'Reading capacity', 'Connect wallet']) {
    const html = renderToStaticMarkup(React.createElement(component.V2BorrowForm, { deposit, principal: '50', setPrincipal() {}, term: '90', setTerm() {}, blocker, busy: false, onBorrow() {}, apr: '925', ltv: '3500' }));
    assert.match(html, /ABCD principal/); assert.match(html, /30 days/); assert.match(html, /90 days/); assert.match(html, /180 days/);
    assert.match(html, /Borrow 50 ABCD/); assert.match(html, /70 ABCD/);
    assert.equal(/disabled=""/.test(html), !!blocker);
  }
});
test('V2 direct state follows receipt and authoritative loan settlement', () => {
  assert.equal(stage({}), 'IDLE');
  assert.equal(stage({ operation: 'Collateral deposit' }), 'DEPOSITING');
  assert.equal(stage({ depositConfirmed: true }), 'DEPOSIT_CONFIRMED');
  assert.equal(stage({ capacityLoading: true }), 'CAPACITY_LOADING');
  assert.equal(stage({ deposit }), 'CAPACITY_READY');
  assert.equal(stage({ operation: 'Borrow', deposit }), 'BORROWING');
  assert.equal(stage({ loan: baseLoan }), 'LOAN_ACTIVE');
  assert.equal(stage({ loan: baseLoan, operation: 'Full repayment' }), 'REPAYING');
  assert.equal(stage({ loan: { ...baseLoan, state: 1, outstanding: '0' } }), 'COLLATERAL_WITHDRAWABLE');
  assert.equal(stage({ loan: { ...baseLoan, state: 5, outstanding: '0', collateralETH: '0' } }), 'COLLATERAL_WITHDRAWN');
});
test('V2 margin call, cure and liquidation never infer cure from top-up success', () => {
  const margin = { ...baseLoan, state: 6 };
  assert.equal(stage({ loan: margin }), 'MARGIN_CALL');
  assert.equal(stage({ loan: margin, operation: 'Partial repayment' }), 'CURE_BY_REPAYMENT');
  assert.equal(stage({ loan: margin, operation: 'Loan collateral top-up' }), 'CURE_BY_COLLATERAL');
  assert.equal(stage({ loan: margin, operation: null }), 'MARGIN_CALL');
  assert.equal(stage({ loan: { ...baseLoan, state: 3 } }), 'DEFAULTED');
  assert.equal(stage({ loan: { ...baseLoan, state: 3, liquidatable: true } }), 'LIQUIDATION_ELIGIBLE');
  assert.equal(stage({ loan: { ...baseLoan, state: 4 } }), 'LIQUIDATED');
});
test('V2 loan actions reject empty, foreign, terminal or unsettled loans', () => {
  assert.deepEqual(flow.loanActions(null, borrower), { repay: false, topUp: false, withdraw: false });
  assert.deepEqual(flow.loanActions(baseLoan, other), { repay: false, topUp: false, withdraw: false });
  assert.deepEqual(flow.loanActions(baseLoan, borrower), { repay: true, topUp: true, withdraw: false });
  assert.equal(flow.loanActions({ ...baseLoan, state: 1, outstanding: '0' }, borrower).withdraw, true);
  for (const state of [3, 4, 5]) assert.equal(flow.loanActions({ ...baseLoan, state }, borrower).repay, false);
});
test('V2 initial dashboard separates P2P and retains useful inactive steps', () => {
  const html = renderToStaticMarkup(React.createElement(component.LendingV2));
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(html, /Direct Lending/); assert.match(html, /P2P Lending/);
  assert.match(html, /Repayment becomes available after a loan is created/);
  assert.match(html, /Collateral top-ups become available/);
  assert.match(html, /Collateral can be withdrawn after the loan is fully settled/);
  assert.match(html, /Advanced Protocol Details/);
  assert.match(source, /Canonical Reserve evidence/);
  assert.match(source, /Reserve cover cap/);
  assert.match(source, /ReserveUsed/);
  assert.match(source, /Reserve contribution/);
  assert.match(source, /Bad debt/);
  assert.doesNotMatch(html, /Approve ABCD &amp; fund request/);
  assert.match(html, /sm:grid-cols-2/);
});

test('P2P funding loads an explicitly selected canonical request before exposing funding', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(source, /aria-label="Load P2P request from LoanMarketplaceV2"/);
  assert.match(source, /const loadP2PRequest = \(\) =>/);
  assert.match(source, /void request\.reload\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(source, /Reading request directly from LoanMarketplaceV2/);
  assert.match(source, /fundV2Request\(requestId, progress\)/);
  assert.match(service, /const request = await getV2Request\(requestId\)/);
  assert.match(service, /market\.fundRequest\.estimateGas\(requestId\)/);
});

test('P2P recovered requests retain the canonical marketplace state label', () => {
  assert.equal(component.p2pRequestStateLabel(0), 'Open');
  assert.equal(component.p2pRequestStateLabel(4), 'Recovered');
  assert.equal(component.p2pRequestStateLabel(5), 'Unknown (5)');
});

test('P2P request history uses only canonical lifecycle events with deterministic cursor continuation', async () => {
  const originalFetch = global.fetch;
  const calls = [];
  let responseNumber = 0;
  global.fetch = async url => {
    calls.push(String(url));
    responseNumber += 1;
    const history = responseNumber === 1
      ? [
        { eventName: 'RequestCreated', blockNumber: '104', transactionHash: '0xcreated', logIndex: 0, args: { requestId: '1' } },
        { eventName: 'RequestFunded', blockNumber: '106', transactionHash: '0xfunded', logIndex: 1, args: { requestId: '1' } },
      ]
      : [{ eventName: 'RequestRepaid', blockNumber: '109', transactionHash: '0xrepaid', logIndex: 0, args: { requestId: '1' } }];
    return {
      ok: true,
      json: async () => ({
        status: 'AVAILABLE',
        source: { kind: 'canonical-v2-indexed-on-chain', chainId: '31337', deploymentVersion: 'lending-v2-test' },
        data: { requestId: '1', request: { borrower, lender: other, principal: ethers.parseEther('70').toString(), collateral: ethers.parseEther('0.1').toString(), term: '7776000', state: '1', loanId: '4', initialLtvBps: '3500' }, history },
        page: { nextCursor: responseNumber === 1 ? 'cursor-106' : null },
      }),
    };
  };
  try {
    const service = load('src/Services/lendingV2.ts', {
      '../Config/contracts': { DEPLOYMENT_CHAIN_ID: 31337n, CONTRACTS: {}, LENDING_V2_CONTRACTS: {}, getLendingV2DeploymentBlock: () => 1, getLendingV2DeploymentVersion: () => 'lending-v2-test' },
      './contractProvider': { provider: {} }, './wallet': { getProvider: async () => ({}) },
    });
    const first = await service.getV2P2PRequestHistory('1', { limit: 2 });
    const second = await service.getV2P2PRequestHistory('1', { limit: 2, cursor: first.nextCursor });
    assert.match(calls[0], /\/api\/lending-v2\/requests\/1\?limit=2$/);
    assert.match(calls[1], /\/api\/lending-v2\/requests\/1\?limit=2&cursor=cursor-106$/);
    assert.deepEqual(first.history.map(event => event.eventName), ['RequestCreated', 'RequestFunded']);
    assert.equal(first.nextCursor, 'cursor-106');
    assert.deepEqual(second.history.map(event => event.eventName), ['RequestRepaid']);
    assert.equal(second.nextCursor, null);
  } finally { global.fetch = originalFetch; }
});

test('P2P request history rejects unrelated Direct Lending events instead of presenting them as P2P history', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      status: 'AVAILABLE',
      source: { kind: 'canonical-v2-indexed-on-chain', chainId: '31337', deploymentVersion: 'lending-v2-test' },
      data: { requestId: '1', request: { borrower, lender: other, principal: '0', collateral: '0', term: '0', state: '0', loanId: '0', initialLtvBps: '3500' }, history: [{ eventName: 'CollateralLocked', blockNumber: '80', transactionHash: '0xdirect', logIndex: 0, args: { requestId: '1' } }] },
      page: { nextCursor: null },
    }),
  });
  try {
    const service = load('src/Services/lendingV2.ts', {
      '../Config/contracts': { DEPLOYMENT_CHAIN_ID: 31337n, CONTRACTS: {}, LENDING_V2_CONTRACTS: {}, getLendingV2DeploymentBlock: () => 1, getLendingV2DeploymentVersion: () => 'lending-v2-test' },
      './contractProvider': { provider: {} }, './wallet': { getProvider: async () => ({}) },
    });
    await assert.rejects(service.getV2P2PRequestHistory('1'), /invalid lifecycle event/);
  } finally { global.fetch = originalFetch; }
});

test('P2P history UI consumes the canonical endpoint without reconstructing generic lending events', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(source, /Canonical P2P request history/);
  assert.match(source, /getV2P2PRequestHistory\(requestId, \{ limit: 20, cursor \}\)/);
  assert.match(source, /Load more history/);
  assert.doesNotMatch(source, /CollateralLocked.*P2P request history/);
});

function serviceHarness() {
  const abi = require(path.join(root, 'artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json')).abi;
  const iface = new ethers.Interface(abi);
  const createLog = (id, who, amount, blockNumber) => ({ address: poolAddress, blockNumber, ...iface.encodeEventLog(iface.getEvent('CollateralDepositCreated'), [id, who, amount]) });
  const records = new Map([['27', { borrower, amount: ethers.parseEther('0.1'), active: true }], ['28', { borrower: other, amount: ethers.parseEther('1'), active: true }], ['29', { borrower, amount: ethers.parseEther('1'), active: false }]]);
  const provider = {
    getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000',
    getBlock: async () => ({ timestamp: 1_000 }),
    getTransactionCount: async (address, blockTag) => { assert.equal(address, borrower); assert.equal(blockTag, 'pending'); return 5; },
    getLogs: async () => [createLog(27, borrower, ethers.parseEther('0.1'), 4), createLog(28, other, ethers.parseEther('1'), 5), createLog(29, borrower, ethers.parseEther('1'), 6)],
  };
  const pool = {
    pendingCollateral: async id => records.get(String(id)),
    maxBorrowable: async amount => { assert.equal(amount, ethers.parseEther('0.1')); return ethers.parseEther('70'); },
    collateralValueUSD: async amount => { assert.equal(amount, ethers.parseEther('0.1')); return ethers.parseEther('200'); },
  };
  const vault = { directDepositCollateral: async id => records.get(String(id)).amount };
  let walletCacheInvalidations = 0;
  const service = load('src/Services/lendingV2.ts', {
    ethers: { ...ethers, Contract: function(address) { return address === poolAddress ? pool : vault; } },
    '../Config/contracts': { DEPLOYMENT_CHAIN_ID: 31337n, CONTRACTS: {}, LENDING_V2_CONTRACTS: { pool: poolAddress, vault: vaultAddress }, getLendingV2DeploymentBlock: () => 1 },
    './contractProvider': { provider },
    './wallet': { getProvider: async () => provider, clearWalletCache: () => { walletCacheInvalidations += 1; } },
  }, '\nexport { depositReceipt, confirmedTransaction, walletTransactionOverrides, v2EmiSchedule, repayAllApprovalAmount };');
  return { service, createLog, records, walletCacheInvalidations: () => walletCacheInvalidations };
}
test('V2 confirmed wallet transactions invalidate a cached signer before a follow-up write', async () => {
  const { service, walletCacheInvalidations } = serviceHarness();
  await service.confirmedTransaction('approval', async () => ({
    hash: '0xconfirmed',
    wait: async () => ({ status: 1, blockNumber: 7 }),
  }));
  assert.equal(walletCacheInvalidations(), 1);
  await assert.rejects(service.confirmedTransaction('reverted', async () => ({
    hash: '0xreverted',
    wait: async () => ({ status: 0, blockNumber: 8 }),
  })));
  assert.equal(walletCacheInvalidations(), 1);
});
test('V2 wallet writes use the canonical pending nonce rather than a stale injected-wallet nonce', async () => {
  const { service } = serviceHarness();
  assert.deepEqual(
    await service.walletTransactionOverrides({ getAddress: async () => borrower }, 123n),
    { gasLimit: 123n, nonce: 5 },
  );
  assert.deepEqual(
    await service.walletTransactionOverrides({ getAddress: async () => borrower }, 456n, 789n),
    { gasLimit: 456n, nonce: 5, value: 789n },
  );
});
test('V2 receipt parsing propagates the real event ID and rejects wrong pool/wallet/amount', async () => {
  const { service, createLog } = serviceHarness();
  const good = createLog(27, borrower, ethers.parseEther('0.1'), 4);
  const send = logs => async () => ({ hash: 'test-receipt-hash', wait: async () => ({ status: 1, blockNumber: 4, logs }) });
  const receipt = await service.depositReceipt(send([good]), poolAddress, borrower, ethers.parseEther('0.1'));
  assert.equal(receipt.depositId, '27'); assert.equal(receipt.blockNumber, '4');
  for (const logs of [[], [{ ...good, address: other }], [createLog(27, other, ethers.parseEther('0.1'), 4)]]) {
    await assert.rejects(service.depositReceipt(send(logs), poolAddress, borrower, ethers.parseEther('0.1')));
  }
});
test('V2 remount recovery selects actual owned active logs instead of highest ID or counts', async () => {
  const { service } = serviceHarness();
  const recovered = await service.getV2LatestPendingDepositForWallet(borrower);
  assert.equal(recovered.depositId, '27'); assert.equal(recovered.collateralETH, '0.1');
  assert.equal(recovered.maxBorrowable, '70.0'); assert.equal(recovered.collateralUSD, '200.0');
});
test('V2 transaction progress only confirms after a successful receipt', async () => {
  const { service } = serviceHarness();
  const stages = [];
  let resolve;
  const waiting = new Promise(done => { resolve = done; });
  const operation = service.confirmedTransaction('Borrow', async () => ({ hash: 'test-hash', wait: () => waiting }), p => stages.push(p.stage));
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(stages, ['wallet', 'submitted', 'confirming']);
  resolve({ status: 1, blockNumber: 5 });
  await operation;
  assert.equal(stages.at(-1), 'confirmed');
  await assert.rejects(service.confirmedTransaction('Borrow', async () => ({ hash: 'failed-hash', wait: async () => ({ status: 0 }) })));
  await assert.rejects(service.confirmedTransaction('Borrow', async () => { throw new Error('User rejected'); }));
});
test('repay-all approval covers a bounded stale-local-block interval before the approval transaction mines', () => {
  const { service } = serviceHarness();
  const outstanding = ethers.parseEther('100');
  const loan = { principalOutstanding: outstanding, aprBps: 925n };
  const denominator = 10_000n * 365n * 86_400n;
  const current = service.repayAllApprovalAmount(outstanding, loan, 1_000n, 1_000n);
  const stale = service.repayAllApprovalAmount(outstanding, loan, 1_000n, 2_000n);
  assert.equal(current, outstanding + outstanding * 925n * 600n / denominator + 1n);
  assert.equal(stale, outstanding + outstanding * 925n * 1_600n / denominator + 1n);
  assert.ok(stale > current);
  const capped = service.repayAllApprovalAmount(outstanding, loan, 0n, 1_000_000n);
  assert.equal(capped, outstanding + outstanding * 925n * 86_400n / denominator + 1n);
});
test('repay-all refreshes its bounded allowance after completion metadata and after a mined approval', () => {
  const source = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(source, /async function currentRepayAllApprovalAmount\(loanId: string, manager: Contract\)/);
  assert.match(source, /const completion = completionMetadataArgument\(await prepareCompletionMetadata\(loanId\)\);/);
  assert.match(source, /const initialApproval = await approveIfNeeded\(v2Contracts\(\)\.pool, await currentRepayAllApprovalAmount\(loanId, manager\), progress\);/);
  assert.match(source, /const refreshedApproval = await approveIfNeeded\(v2Contracts\(\)\.pool, await currentRepayAllApprovalAmount\(loanId, manager\), progress\);/);
  assert.match(source, /approvalHashes/);
});
test('scheduled P2P EMI uses bounded accrued-interest allowance guards and Direct liquidation submits only to configured on-chain execution', () => {
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(service, /async function accruingLoanApprovalAmount\(loanId: string, amount: bigint, manager: Contract\)/);
  assert.match(service, /const approvalAmount = await accruingLoanApprovalAmount\(loanId, installment\.amount, manager\);/);
  assert.match(service, /The next P2P EMI is not due until canonical block time/);
  assert.match(service, /async function liquidateV2\(loanId: string, progress\?: V2ProgressListener\): Promise<V2Tx>/);
  assert.match(service, /liquidation\.liquidate\.estimateGas\(loanId\)/);
  assert.doesNotMatch(service, /previewLiquidation\(loanId\)/);
});
test('Direct installment controls read the canonical schedule and call the Direct pool path', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(source, /Next Direct installment/);
  assert.match(source, /Installments paid/);
  assert.match(source, /Approve ABCD & pay next installment/);
  assert.match(source, /payV2DirectInstallment\(loanId, prepareCompletionMetadata, progress\)/);
  assert.match(service, /emiRead\.previewDirectInstallment\(loanId\)/);
  assert.match(service, /pool\.payDirectInstallmentWithCompletionMetadata\.estimateGas/);
  assert.match(service, /pool\.payDirectInstallment\.estimateGas/);
  assert.doesNotMatch(service, /payV2DirectInstallment[\s\S]{0,1000}emi\.payInstallment/);
});
test('V2 confirmed receipt remains visible when an indexer refresh fails', () => {
  const html = renderToStaticMarkup(React.createElement(present.V2TransactionStatus, { state: { action: 'Borrow', result: { hash: 'test-receipt-hash', blockNumber: '55', loanId: '31', depositId: null, requestId: null, approvalHashes: [] }, refreshWarning: 'Indexer unavailable' } }));
  assert.match(html, /Confirmed/); assert.match(html, /31/); assert.match(html, /55/);
  assert.match(html, /do not resubmit/); assert.doesNotMatch(html, /Failed/);
});

test('canonical indexed wallet-history reads bypass browser HTTP cache after an explicit reload', () => {
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(service, /async function apiGet<T>\(path: string\)[\s\S]*fetch\(path, \{ cache: 'no-store' \}\)/);
  assert.match(service, /getV2WalletHistory\(wallet: string\)[\s\S]*\/api\/lending-v2\/wallet\/\$\{wallet\}\?limit=100/);
});

test('direct Loan #1-style reads never index an empty canonical EMI result', () => {
  const { service } = serviceHarness();
  const emptySchedule = new Proxy([], { get(target, property, receiver) {
    if (property === '0') throw new RangeError('out of result range');
    return Reflect.get(target, property, receiver);
  } });
  assert.equal(service.v2EmiSchedule(emptySchedule, 0n, 0n), null);
  const p2pSchedule = service.v2EmiSchedule([{ amount: ethers.parseEther('50'), dueAt: 1234n }], 0n, 1200n);
  assert.deepEqual(p2pSchedule, {
    installmentAmount: '50.0', amountApplied: '0.0', remainingDue: '50.0', state: 'DUE',
    installmentCount: '1', paidInstallments: '0', nextDueAt: '1234', chainTimestamp: '1200', due: false, completed: false,
  });
  assert.equal(service.v2EmiSchedule([{ amount: ethers.parseEther('50'), dueAt: 1234n }], 0n, 1234n)?.due, true);
  const terminalRecovery = service.v2EmiSchedule([{
    amount: ethers.parseEther('50'), dueAt: 1234n, paid: true,
    amountApplied: ethers.parseEther('50'), state: 2n,
  }], 1n, 1300n, true);
  assert.deepEqual(terminalRecovery, {
    installmentAmount: '50.0', amountApplied: '50.0', remainingDue: '0.0', state: 'SETTLED',
    installmentCount: '1', paidInstallments: '1', nextDueAt: '1234', chainTimestamp: '1300', due: true, completed: true,
  });
});

test('fresh Loan #1 recovery uses canonical DirectLoanOpened evidence without waiting for the indexer', async () => {
  const poolAbi = require(path.join(root, 'artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json')).abi;
  const iface = new ethers.Interface(poolAbi);
  const loanId = 1n;
  const log = { address: poolAddress, ...iface.encodeEventLog(iface.getEvent('DirectLoanOpened'), [loanId, 1n, borrower, ethers.parseEther('100'), ethers.parseEther('0.1'), 30n * 86400n, 1_800_000_000n]) };
  const provider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000', getLogs: async filter => { assert.equal(filter.address, poolAddress); return [log]; } };
  const manager = { getLoan: async id => { assert.equal(String(id), '1'); return { borrower, lender: poolAddress }; } };
  const service = load('src/Services/lendingV2.ts', {
    ethers: { ...ethers, Contract: function(address) { return address === '0x5555555555555555555555555555555555555555' ? manager : {}; } },
    '../Config/contracts': { DEPLOYMENT_CHAIN_ID: 31337n, CONTRACTS: {}, LENDING_V2_CONTRACTS: { pool: poolAddress, manager: '0x5555555555555555555555555555555555555555' }, getLendingV2DeploymentBlock: () => 1 },
    './contractProvider': { provider }, './wallet': { getProvider: async () => provider },
  });
  assert.equal(await service.getV2LatestDirectLoanForWallet(borrower), '1');
});

test('direct V2 borrowing has no pre-origination LoanNFT metadata requirement', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Create & publish signed LoanNFT metadata/);
  assert.doesNotMatch(source, /LoanNFT certificate artwork \(PNG\)/);
  assert.match(source, /borrowV2\(depositId, principal, Number\(term\), progress\)/);
  assert.match(service, /pool\.borrowABCD\.estimateGas\(depositId, amount, termDays \* 86400\)/);
});

test('P2P V2 request creation has no pre-funding completion-certificate metadata requirement', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Create & publish signed P2P LoanNFT metadata/);
  assert.doesNotMatch(source, /P2P LoanNFT certificate artwork/);
  assert.match(source, /createV2Request\(p2pPrincipal, p2pCollateral, Number\(p2pTerm\), progress\)/);
  assert.match(service, /market\.createRequest\.estimateGas\(amount, termDays \* 86400, \{ value \}\)/);
});

test('full settlement prepares verified role-specific public-IPFS metadata without a borrower artwork picker', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const publisher = fs.readFileSync(new URL('../src/Services/lendingV2Metadata.ts', import.meta.url), 'utf8');
  assert.match(source, /prepareLoanCompletionMetadata\(\{ loanId: selectedLoanId, borrower: wallet \}\)/);
  assert.match(source, /repayAllV2\(loanId, prepareCompletionMetadata, progress\)/);
  assert.match(source, /payV2Emi\(p2pLoanId, prepareCompletionMetadata, progress\)/);
  assert.match(source, /!p2pLoan\.schedule\.due/);
  assert.match(publisher, /\/api\/lending-v2\/metadata\/completion/);
  assert.doesNotMatch(publisher, /signMessage|FormData/);
});

test('completion-metadata preparation refreshes an existing session once after an expired access token', () => {
  const publisher = fs.readFileSync(new URL('../src/Services/lendingV2Metadata.ts', import.meta.url), 'utf8');
  assert.match(publisher, /const REFRESH_TOKEN_KEY = 'abcdefi_auth_refresh';/);
  assert.match(publisher, /fetch\('\/api\/user\/refresh-token'/);
  assert.match(publisher, /if \(response\.status === 401\)/);
  assert.match(publisher, /const refreshed = await refreshStoredAccessToken\(\);/);
  assert.match(publisher, /response = await requestCompletionMetadata\(input\.loanId, token\);/);
  assert.match(publisher, /window\.dispatchEvent\(new Event\('abcdefi-auth-session-changed'\)\)/);
});

test('P2P request capacity is read from LoanMarketplaceV2 and blocks an over-cap UI request', async () => {
  const marketplace = '0x6666666666666666666666666666666666666666';
  const provider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000' };
  const market = {
    collateralValueUSD: async amount => { assert.equal(amount, ethers.parseEther('0.1')); return ethers.parseEther('200'); },
    previewMaxP2PPrincipal: async amount => { assert.equal(amount, ethers.parseEther('0.1')); return ethers.parseEther('70'); },
    P2P_INITIAL_LTV_BPS: async () => 3500n,
  };
  const service = load('src/Services/lendingV2.ts', {
    ethers: { ...ethers, Contract: function(address) { assert.equal(address, marketplace); return market; } },
    '../Config/contracts': { DEPLOYMENT_CHAIN_ID: 31337n, CONTRACTS: {}, LENDING_V2_CONTRACTS: { marketplace }, getLendingV2DeploymentBlock: () => 1 },
    './contractProvider': { provider }, './wallet': { getProvider: async () => provider },
  });
  assert.deepEqual(await service.getV2P2PRequestCapacity('0.1'), { collateralETH: '0.1', collateralUSD: '200.0', maxPrincipal: '70.0', initialLtvBps: '3500' });
  assert.equal(flow.withinCapacity('70', '70'), true);
  assert.equal(flow.withinCapacity('70.000000000000000001', '70'), false);
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(source, /getV2P2PRequestCapacity\(p2pCollateral\)/);
  assert.match(source, /P2P initial LTV/);
  assert.match(source, /Maximum P2P principal/);
  assert.match(source, /!p2pWithinCapacity/);
});

test('due-installment recovery uses the approved canonical path while P2P partial/default settlement stays fail-closed', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(source, /Execute due collateral recovery/);
  assert.match(source, /DUE → PARTIALLY_SETTLED → SETTLED/);
  assert.match(service, /liquidation\.executeOverdueInstallment\.estimateGas\(loanId\)/);
  assert.match(service, /Due-installment collateral recovery/);
  assert.match(service, /P2P default settlement is blocked/);
  assert.match(source, /P2P partial liquidation, reserve\/bad-debt settlement, and terminal default recovery remain fail-closed/);
  assert.doesNotMatch(service, /Math\.random\(\)|mock.*overdue|fake.*overdue/i);
});

test('Direct partial-liquidation UI reports eligibility and exposes only a configured canonical execution path', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(source, /Partial liquidation required/);
  assert.match(source, /partialLiquidationExecution === 'CONFIGURED'/);
  assert.match(source, /Execute configured partial liquidation/);
  assert.match(source, /liquidateV2\(loanId, progress\)/);
  assert.doesNotMatch(source, /Direct liquidation bonus/);
});

test('lending UI renders only canonical recovery and completion-valuation provenance', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(source, /Recovery state/);
  assert.match(source, /Amount applied/);
  assert.match(source, /Remaining scheduled due/);
  assert.match(source, /Informational 1% USD valuation/);
  assert.match(source, /Valuation feed/);
  assert.match(source, /Valuation round/);
  assert.doesNotMatch(source, /Blocked: USD valuation policy required/);
  assert.match(source, /A normal partial liquidation never uses Reserve coverage or creates bad debt/);
});

test('lending UI labels immutable origination collateral separately from the current vault balance', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../src/Services/lendingV2.ts', import.meta.url), 'utf8');
  assert.match(source, /label="Original collateral" value=\{`\$\{loan\.originalCollateralETH\} ETH`\}/);
  assert.match(source, /label="Current vault collateral" value=\{`\$\{loan\.currentVaultCollateralETH\} ETH`\}/);
  assert.doesNotMatch(source, /label="Remaining collateral \(vault\)" value=\{`\$\{loan\.collateralETH\} ETH`\}/);
  assert.match(service, /originalCollateralETH: formatEther\(loan\.collateralETH\), currentVaultCollateralETH: formatEther\(liveCollateral\)/);
  assert.match(service, /const liveCollateral = await vault\.loanCollateral\(loanId\)/);
});

test('the local Phase 1 harness has no environment-gated legacy P2P liquidation path', () => {
  const harness = fs.readFileSync(new URL('./run-phase1-local-application-e2e.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(harness, /PHASE1_RESUME_LIQUIDATION/);
  assert.doesNotMatch(harness, /resumed P2P partial liquidation/);
  assert.doesNotMatch(harness, /previewP2PPartialLiquidation\(/);
});

test('a P2P borrower can cure a margin call through the canonical loan-scoped collateral top-up path', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(source, /P2P Margin Call Active/);
  assert.match(source, /Additional P2P ETH collateral/);
  assert.match(source, /addV2LoanCollateral\(p2pLoanId, p2pTopUp, progress\)/);
  assert.match(source, /P2P risk-state synchronization/);
  assert.doesNotMatch(source, /P2P.*Math\.random|fake.*P2P/i);
});
