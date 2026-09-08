import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ethers from 'ethers';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
function load(relative, overrides = {}, expose = '') {
  const absolute = path.resolve(root, relative);
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8') + expose, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = spec => {
    if (Object.hasOwn(overrides, spec)) return overrides[spec];
    if (!spec.startsWith('.')) return require(spec);
    const base = path.resolve(path.dirname(absolute), spec);
    if (base.endsWith('.json')) return require(base);
    const file = ['.ts', '.tsx', '.js', ''].map(ext => base + ext).find(file => fs.existsSync(file));
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
const deposit = { depositId: '27', collateralETH: '0.1', collateralUSD: '200', maxBorrowable: '100', borrower, active: true };
const input = { deposit, depositId: '27', address: borrower, connected: true, correctNetwork: true, loading: false, error: null, principal: '100', term: '30', uri: 'ipfs://test-fixture-metadata', hash: ethers.id('fixture') };
const baseLoan = { state: 0, borrower, outstanding: '100', collateralETH: '0.1', liquidatable: false };
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
    { term: '60' }, { uri: 'http://localhost/metadata' }, { hash: '0x' + '0'.repeat(64) },
  ]) assert.ok(flow.borrowBlocker({ ...input, ...change }), JSON.stringify(change));
  assert.equal(flow.borrowBlocker({ ...input, principal: '250', deposit: { ...deposit, maxBorrowable: '250' }, term: '90' }), null);
  assert.equal(flow.borrowBlocker({ ...input, term: '180' }), null);
});

test('terminal repayment uses the completion path even when equivalent decimal strings differ', () => {
  assert.equal(flow.sameAmount('70', '70.0'), true);
  assert.equal(flow.sameAmount('70.000000000000000001', '70'), false);
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  assert.match(source, /sameAmount\(repayment, loan!\.outstanding\)/);
  assert.match(source, /sameAmount\(p2pPayment, p2pLoan\.outstanding\)/);
});

test('V2 borrow controls stay rendered during loading, missing metadata and empty states', () => {
  for (const blocker of [null, 'Reading capacity', 'Metadata missing', 'Connect wallet']) {
    const html = renderToStaticMarkup(React.createElement(component.V2BorrowForm, { deposit, principal: '50', setPrincipal() {}, term: '90', setTerm() {}, blocker, busy: false, onBorrow() {}, apr: '1200', ltv: '5000' }));
    assert.match(html, /ABCD principal/); assert.match(html, /30 days/); assert.match(html, /90 days/); assert.match(html, /180 days/);
    assert.match(html, /Borrow 50 ABCD/); assert.match(html, /100 ABCD/);
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
  assert.match(html, /Direct Lending/); assert.match(html, /P2P Lending/);
  assert.match(html, /Repayment becomes available after a loan is created/);
  assert.match(html, /Collateral top-ups become available/);
  assert.match(html, /Collateral can be withdrawn after the loan is fully settled/);
  assert.match(html, /Advanced Protocol Details/);
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

function serviceHarness() {
  const abi = require(path.join(root, 'artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json')).abi;
  const iface = new ethers.Interface(abi);
  const createLog = (id, who, amount, blockNumber) => ({ address: poolAddress, blockNumber, ...iface.encodeEventLog(iface.getEvent('CollateralDepositCreated'), [id, who, amount]) });
  const records = new Map([['27', { borrower, amount: ethers.parseEther('0.1'), active: true }], ['28', { borrower: other, amount: ethers.parseEther('1'), active: true }], ['29', { borrower, amount: ethers.parseEther('1'), active: false }]]);
  const provider = {
    getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000',
    getBlock: async () => ({ timestamp: 1_000 }),
    getLogs: async () => [createLog(27, borrower, ethers.parseEther('0.1'), 4), createLog(28, other, ethers.parseEther('1'), 5), createLog(29, borrower, ethers.parseEther('1'), 6)],
  };
  const pool = {
    pendingCollateral: async id => records.get(String(id)),
    maxBorrowable: async amount => { assert.equal(amount, ethers.parseEther('0.1')); return ethers.parseEther('100'); },
    collateralValueUSD: async amount => { assert.equal(amount, ethers.parseEther('0.1')); return ethers.parseEther('200'); },
  };
  const vault = { directDepositCollateral: async id => records.get(String(id)).amount };
  const service = load('src/Services/lendingV2.ts', {
    ethers: { ...ethers, Contract: function(address) { return address === poolAddress ? pool : vault; } },
    '../Config/contracts': { DEPLOYMENT_CHAIN_ID: 31337n, CONTRACTS: {}, LENDING_V2_CONTRACTS: { pool: poolAddress, vault: vaultAddress }, getLendingV2DeploymentBlock: () => 1 },
    './contractProvider': { provider },
    './wallet': { getProvider: async () => provider },
  }, '\nexport { depositReceipt, confirmedTransaction, v2EmiSchedule, repayAllApprovalAmount };');
  return { service, createLog, records };
}
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
  assert.equal(recovered.maxBorrowable, '100.0'); assert.equal(recovered.collateralUSD, '200.0');
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
  const loan = { principalOutstanding: outstanding, aprBps: 1200n };
  const denominator = 10_000n * 365n * 86_400n;
  const current = service.repayAllApprovalAmount(outstanding, loan, 1_000n, 1_000n);
  const stale = service.repayAllApprovalAmount(outstanding, loan, 1_000n, 2_000n);
  assert.equal(current, outstanding + outstanding * 1200n * 600n / denominator + 1n);
  assert.equal(stale, outstanding + outstanding * 1200n * 1_600n / denominator + 1n);
  assert.ok(stale > current);
  const capped = service.repayAllApprovalAmount(outstanding, loan, 0n, 1_000_000n);
  assert.equal(capped, outstanding + outstanding * 1200n * 86_400n / denominator + 1n);
});
test('V2 confirmed receipt remains visible when an indexer refresh fails', () => {
  const html = renderToStaticMarkup(React.createElement(present.V2TransactionStatus, { state: { action: 'Borrow', result: { hash: 'test-receipt-hash', blockNumber: '55', loanId: '31', depositId: null, requestId: null, approvalHashes: [] }, refreshWarning: 'Indexer unavailable' } }));
  assert.match(html, /Confirmed/); assert.match(html, /31/); assert.match(html, /55/);
  assert.match(html, /do not resubmit/); assert.doesNotMatch(html, /Failed/);
});

test('direct Loan #1-style reads never index an empty canonical EMI result', () => {
  const { service } = serviceHarness();
  const emptySchedule = new Proxy([], { get(target, property, receiver) {
    if (property === '0') throw new RangeError('out of result range');
    return Reflect.get(target, property, receiver);
  } });
  assert.equal(service.v2EmiSchedule(emptySchedule, 0n), null);
  const p2pSchedule = service.v2EmiSchedule([{ amount: ethers.parseEther('50'), dueAt: 1234n }], 0n);
  assert.deepEqual(p2pSchedule, { installmentAmount: '50.0', installmentCount: '1', paidInstallments: '0', nextDueAt: '1234', completed: false });
});

test('fresh Loan #1 recovery uses canonical DirectLoanOpened evidence without waiting for the indexer', async () => {
  const poolAbi = require(path.join(root, 'artifacts/contracts/lending/v2/LendingPoolV2.sol/LendingPoolV2.json')).abi;
  const iface = new ethers.Interface(poolAbi);
  const loanId = 1n;
  const log = { address: poolAddress, ...iface.encodeEventLog(iface.getEvent('DirectLoanOpened'), [loanId, 1n, borrower, ethers.parseEther('100'), ethers.parseEther('0.1'), 30n * 86400n, 1_800_000_000n, ethers.id('metadata'), 'ipfs://bafkreidk7waqe73m4bdujx66tozlacpvyn6mfojuvqnoqm3wapjri2q3du']) };
  const provider = { getNetwork: async () => ({ chainId: 31337n }), getCode: async () => '0x6000', getLogs: async filter => { assert.equal(filter.address, poolAddress); return [log]; } };
  const manager = { getLoan: async id => { assert.equal(String(id), '1'); return { borrower, lender: poolAddress }; } };
  const service = load('src/Services/lendingV2.ts', {
    ethers: { ...ethers, Contract: function(address) { return address === '0x5555555555555555555555555555555555555555' ? manager : {}; } },
    '../Config/contracts': { DEPLOYMENT_CHAIN_ID: 31337n, CONTRACTS: {}, LENDING_V2_CONTRACTS: { pool: poolAddress, manager: '0x5555555555555555555555555555555555555555' }, getLendingV2DeploymentBlock: () => 1 },
    './contractProvider': { provider }, './wallet': { getProvider: async () => provider },
  });
  assert.equal(await service.getV2LatestDirectLoanForWallet(borrower), '1');
});

test('direct V2 loans publish signed IPFS metadata for the exact borrow intent instead of accepting a manual URI', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const flowSource = fs.readFileSync(new URL('../src/Utils/lendingV2Flow.ts', import.meta.url), 'utf8');
  const publisher = fs.readFileSync(new URL('../src/Services/lendingV2Metadata.ts', import.meta.url), 'utf8');
  assert.match(source, /Create & publish signed LoanNFT metadata/);
  assert.match(source, /publishDirectLoanMetadata\(\{ asset: metadataAsset, depositId, principal, termDays: Number\(term\), borrower: wallet \}\)/);
  assert.match(source, /metadataMatchesLoanIntent\(publishedMetadata\?\.intent/);
  assert.match(flowSource, /Publish signed LoanNFT metadata for this exact deposit, borrower, principal, and term/);
  assert.match(publisher, /signer\.signMessage\(directLoanMetadataIntentMessage\(intent\)\)/);
  assert.match(publisher, /metadataHash !== id\(stored\.metadataUri\)/);
  assert.match(publisher, /\/api\/lending-v2\/metadata\/direct/);
});

test('P2P V2 requests publish signed public metadata for their exact borrower, principal, collateral, and term', () => {
  const source = fs.readFileSync(new URL('../src/components/LendingV2.tsx', import.meta.url), 'utf8');
  const publisher = fs.readFileSync(new URL('../src/Services/lendingV2Metadata.ts', import.meta.url), 'utf8');
  assert.match(source, /Create & publish signed P2P LoanNFT metadata/);
  assert.match(source, /publishP2PRequestMetadata\(\{ asset: p2pMetadataAsset, principal: p2pPrincipal, collateral: p2pCollateral, termDays: Number\(p2pTerm\), borrower: wallet \}\)/);
  assert.match(source, /p2pMetadataMatches/);
  assert.doesNotMatch(source, /Hash entered URI/);
  assert.match(publisher, /signer\.signMessage\(p2pRequestMetadataIntentMessage\(intent\)\)/);
  assert.match(publisher, /\/api\/lending-v2\/metadata\/p2p/);
  assert.match(publisher, /collateralWei: parseEther\(input\.collateral\)\.toString\(\)/);
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
