/*
 * Disposable B5.3.3 runner. It refuses every RPC except the live R2 fixture.
 * It exercises the deployed B5.1 contracts; no contract, manifest, or
 * protected-runtime mutation is performed by this file.
 */
const fs = require('node:fs');
const path = require('node:path');
const { Contract, Interface, JsonRpcProvider, parseEther } = require('ethers');
const { loadLendingV2Artifacts } = require('../../config/lendingV2Artifacts.cjs');

const RPC = 'http://127.0.0.1:8558';
const CHAIN_ID = 31337;
const BORROWER = '0x976EA74026E726554dB657fA54763abd0C3a0aa9';
const LENDER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ADMIN = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const KEEPER = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const ETH_ASSET = '0x0000000000000000000000000000000000000001';
const DAY = 24 * 60 * 60;

const fail = (message) => { throw new Error(`B5.3.3: ${message}`); };
const bigintJson = (_key, value) => typeof value === 'bigint' ? value.toString() : value;
const asJson = (value) => JSON.parse(JSON.stringify(value, bigintJson));
const named = (args, fragment) => Object.fromEntries(fragment.inputs.map((input, index) => [input.name || String(index), String(args[index])]));

function events(receipt, bindings) {
  const rows = [];
  for (const log of receipt.logs) {
    for (const binding of bindings) {
      if (log.address.toLowerCase() !== binding.address.toLowerCase()) continue;
      try {
        const decoded = binding.iface.parseLog(log);
        rows.push({ contract: binding.name, event: decoded.name, args: named(decoded.args, decoded.fragment) });
      } catch (_) { /* another event from this contract is irrelevant */ }
    }
  }
  return rows;
}

async function main() {
  const runtimeDir = path.resolve(process.env.B53_R2_RUNTIME_DIR || '');
  if (!runtimeDir || !fs.existsSync(path.join(runtimeDir, 'lending.json'))) fail('B53_R2_RUNTIME_DIR must name the live R2 runtime.');
  const lending = JSON.parse(fs.readFileSync(path.join(runtimeDir, 'lending.json'), 'utf8'));
  if (lending.rpcUrl !== RPC || Number(lending.chainId) !== CHAIN_ID) fail('non-R2 manifest refused.');
  const provider = new JsonRpcProvider(RPC);
  if (Number((await provider.getNetwork()).chainId) !== CHAIN_ID) fail('wrong chain.');

  const artifacts = loadLendingV2Artifacts();
  const c = lending.contracts;
  for (const name of ['OracleAdapterV2', 'CollateralVaultV2', 'LoanManagerV2', 'LoanMarketplaceV2', 'LiquidationV2', 'InsuranceReserveV2', 'EMIManagerV2', 'LoanNFTV2', 'LiquidationSaleAdapterV2', 'MockPancakeSwapRouterV2']) {
    if (!c[name]?.address || await provider.getCode(c[name].address) === '0x') fail(`missing R2 bytecode for ${name}.`);
  }

  const [admin, borrower, lender, keeper] = await Promise.all([provider.getSigner(ADMIN), provider.getSigner(BORROWER), provider.getSigner(LENDER), provider.getSigner(KEEPER)]);
  for (const [expected, signer] of [[ADMIN, admin], [BORROWER, borrower], [LENDER, lender], [KEEPER, keeper]]) {
    if ((await signer.getAddress()).toLowerCase() !== expected.toLowerCase()) fail(`unlocked R2 signer unavailable: ${expected}.`);
  }

  const token = new Contract(c.ABCDTokenV2.address, ['function approve(address,uint256) returns (bool)', 'function balanceOf(address) view returns(uint256)'], provider);
  const oracle = new Contract(c.OracleAdapterV2.address, [
    'function feeds(address) view returns(address,uint48,uint48,uint80,uint16,uint8,bool,bool,uint256)',
    'function priceUSD(address) view returns(uint256)',
  ], provider);
  const market = new Contract(c.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, provider);
  const manager = new Contract(c.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
  const vault = new Contract(c.CollateralVaultV2.address, artifacts.CollateralVaultV2.abi, provider);
  const liquidation = new Contract(c.LiquidationV2.address, artifacts.LiquidationV2.abi, provider);
  const reserve = new Contract(c.InsuranceReserveV2.address, artifacts.InsuranceReserveV2.abi, provider);
  const nft = new Contract(c.LoanNFTV2.address, artifacts.LoanNFTV2.abi, provider);
  const adapter = new Contract(c.LiquidationSaleAdapterV2.address, artifacts.LiquidationSaleAdapterV2.abi, provider);
  const router = new Contract(c.MockPancakeSwapRouterV2.address, ['function setRate(uint256,uint256)', 'function rateNumerator() view returns(uint256)', 'function rateDenominator() view returns(uint256)'], provider);
  const bindings = [
    { name: 'LiquidationV2', address: c.LiquidationV2.address, iface: new Interface(artifacts.LiquidationV2.abi) },
    { name: 'LoanManagerV2', address: c.LoanManagerV2.address, iface: new Interface(artifacts.LoanManagerV2.abi) },
    { name: 'LoanMarketplaceV2', address: c.LoanMarketplaceV2.address, iface: new Interface(artifacts.LoanMarketplaceV2.abi) },
    { name: 'CollateralVaultV2', address: c.CollateralVaultV2.address, iface: new Interface(artifacts.CollateralVaultV2.abi) },
    { name: 'InsuranceReserveV2', address: c.InsuranceReserveV2.address, iface: new Interface(artifacts.InsuranceReserveV2.abi) },
    { name: 'LoanNFTV2', address: c.LoanNFTV2.address, iface: new Interface(artifacts.LoanNFTV2.abi) },
    { name: 'ABCDTokenV2', address: c.ABCDTokenV2.address, iface: new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']) },
  ];

  const trace = { runtime: { rpc: RPC, chainId: CHAIN_ID, deploymentVersion: lending.deploymentVersion }, transactions: [], rejections: [], oracleRefreshes: [], scenarios: {} };
  const mine = async (label, promise) => {
    const tx = await promise;
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) fail(`${label} receipt failed.`);
    const block = await provider.getBlock(receipt.blockNumber);
    const record = { label, hash: tx.hash, block: receipt.blockNumber, blockHash: block.hash, from: tx.from, to: tx.to, events: events(receipt, bindings) };
    trace.transactions.push(record);
    return { tx, receipt, record };
  };
  const expectRevert = async (label, action, expected) => {
    try { await action(); fail(`${label} unexpectedly succeeded.`); }
    catch (error) {
      const message = String(error.shortMessage || error.reason || error.message || error);
      if (!message.includes(expected)) fail(`${label} reverted for a different reason: ${message}`);
      trace.rejections.push({ label, expected, observed: message });
    }
  };
  const setNext = async (timestamp) => { await provider.send('evm_setNextBlockTimestamp', [Number(timestamp)]); await provider.send('evm_mine', []); };
  const refreshFeeds = async (ethUsd, label) => {
    const [ethCfg, abcdCfg] = await Promise.all([oracle.feeds(ETH_ASSET), oracle.feeds(c.ABCDTokenV2.address)]);
    const feedAbi = ['function setAnswer(int256)', 'function decimals() view returns(uint8)', 'function latestRoundData() view returns(uint80,int256,uint256,uint256,uint80)'];
    const ethFeed = new Contract(ethCfg[0], feedAbi, admin);
    const abcdFeed = new Contract(abcdCfg[0], feedAbi, admin);
    const eth = await mine(`${label}: ETH/USD refresh`, ethFeed.setAnswer(BigInt(ethUsd) * 10n ** 8n));
    const abcd = await mine(`${label}: ABCD/USD refresh`, abcdFeed.setAnswer(1n * 10n ** 8n));
    const head = await provider.getBlock('latest');
    const [ethRound, abcdRound, ethPrice, abcdPrice] = await Promise.all([ethFeed.latestRoundData(), abcdFeed.latestRoundData(), oracle.priceUSD(ETH_ASSET), oracle.priceUSD(c.ABCDTokenV2.address)]);
    if (ethRound[1] <= 0n || abcdRound[1] <= 0n || BigInt(head.timestamp) - ethRound[3] > ethCfg[1] || BigInt(head.timestamp) - abcdRound[3] > abcdCfg[1]) fail(`${label}: canonical oracle validation failed.`);
    trace.oracleRefreshes.push({ label, ethUsd: String(ethUsd), ethFeed: ethCfg[0], abcdFeed: abcdCfg[0], ethTx: eth.record.hash, abcdTx: abcd.record.hash, ethRoundId: ethRound[0].toString(), abcdRoundId: abcdRound[0].toString(), ethPriceUSD: ethPrice.toString(), abcdPriceUSD: abcdPrice.toString() });
  };
  const createAndFund = async (label, principal, collateral) => {
    const resumeRequest = label === 'Scenario B' ? process.env.B53_R2_RESUME_PARTIAL_REQUEST_ID : null;
    if (resumeRequest) {
      const requestId = BigInt(resumeRequest);
      const request = await market.requests(requestId);
      const loanId = request[6];
      if (loanId === 0n) fail(`${label}: requested resume position has no loan.`);
      const loan = await manager.getLoan(loanId);
      if (!loan[19] || loan[0].toLowerCase() !== BORROWER.toLowerCase() || loan[1].toLowerCase() !== LENDER.toLowerCase() || loan[14] !== 0n || request[4] !== 1n || loan[3] !== principal || loan[2] !== collateral) fail(`${label}: requested resume position is not the exact active fixture.`);
      return { requestId, loanId };
    }
    const create = await mine(`${label}: create request`, market.connect(borrower).createRequest(principal, 30 * DAY, { value: collateral }));
    const created = events(create.receipt, bindings).find((row) => row.contract === 'LoanMarketplaceV2' && row.event === 'RequestCreated');
    if (!created) fail(`${label}: RequestCreated missing.`);
    const requestId = BigInt(created.args.requestId);
    if (await token.balanceOf(LENDER) < principal) fail(`${label}: lender ABCD balance is insufficient.`);
    await mine(`${label}: lender approval`, token.connect(lender).approve(c.LoanMarketplaceV2.address, principal));
    const funded = await mine(`${label}: fund request`, market.connect(lender).fundRequest(requestId));
    const fundedEvent = events(funded.receipt, bindings).find((row) => row.contract === 'LoanMarketplaceV2' && row.event === 'RequestFunded');
    if (!fundedEvent) fail(`${label}: RequestFunded missing.`);
    const loanId = BigInt(fundedEvent.args.loanId);
    const loan = await manager.getLoan(loanId); const request = await market.requests(requestId);
    // `Loan.isP2P` and `Loan.badDebt` were appended to the persisted struct;
    // retain their live ABI positions instead of inferring old layout slots.
    if (!loan[19] || loan[0].toLowerCase() !== BORROWER.toLowerCase() || loan[1].toLowerCase() !== LENDER.toLowerCase() || loan[14] !== 0n || request[4] !== 1n) fail(`${label}: funded P2P binding invalid.`);
    return { requestId, loanId };
  };
  const marginCall = async (label, loanId) => {
    await refreshFeeds(1000n, `${label}: 70 percent threshold`);
    await mine(`${label}: sync risk`, liquidation.connect(keeper).syncRisk(loanId));
    const loan = await manager.getLoan(loanId);
    if (loan[14] !== 6n || loan[13] === 0n) fail(`${label}: margin call was not activated at 70 percent.`);
    return loan;
  };

  // Scenario A + B: a normal strict partial recovery using the original configured local route.
  let partial;
  if (process.env.B53_R2_SKIP_PARTIAL === '1') {
    partial = await createAndFund('Scenario B', parseEther('70'), parseEther('0.1'));
    const resumedLoan = await manager.getLoan(partial.loanId);
    const resumedRequest = await market.requests(partial.requestId);
    const resumedCollateral = await vault.loanCollateral(partial.loanId);
    if (resumedLoan[14] !== 0n || resumedRequest[4] !== 1n || resumedCollateral === 0n || resumedCollateral >= parseEther('0.1') || resumedLoan[4] === 0n || await reserve.reserveUsedByLoan(partial.loanId) !== 0n) fail('Scenario B resume position is not a completed strict partial recovery.');
    // The feed may be deliberately pending a deviation-compatible bridge at
    // this point, so do not perform an LTV read until after that snapshot.
    trace.scenarios.partial = asJson({ requestId: partial.requestId, loanId: partial.loanId, resumed: true, collateralAfter: resumedCollateral, remainingDebt: resumedLoan[4] + resumedLoan[5] + resumedLoan[6], reserveUsed: await reserve.reserveUsedByLoan(partial.loanId) });
  } else {
    await refreshFeeds(2000n, 'Scenario B initial capacity');
    partial = await createAndFund('Scenario B', parseEther('70'), parseEther('0.1'));
    const partialMargin = await marginCall('Scenario A/B', partial.loanId);
    await expectRevert('Scenario A before cure', () => liquidation.connect(keeper).liquidateP2P.staticCall(partial.loanId), 'p2p liquidation not eligible');
    await setNext(partialMargin[13] + 1n);
    await refreshFeeds(1000n, 'Scenario A cure threshold check');
    await expectRevert('Scenario A below 80 percent', () => liquidation.connect(keeper).liquidateP2P.staticCall(partial.loanId), 'p2p liquidation not eligible');
    await refreshFeeds(800n, 'Scenario B liquidation eligibility');
    const partialBefore = { loan: await manager.getLoan(partial.loanId), collateral: await vault.loanCollateral(partial.loanId), lenderBalance: await token.balanceOf(LENDER), reserveUsed: await reserve.reserveUsedByLoan(partial.loanId) };
    const partialLtvBefore = await liquidation.currentLtvBps(partial.loanId);
    if (partialLtvBefore < 8000n) fail('Scenario B did not reach 80 percent LTV.');
    const partialTx = await mine('Scenario B: permissionless strict partial liquidation', liquidation.connect(keeper).liquidateP2P(partial.loanId));
    const partialAfter = { loan: await manager.getLoan(partial.loanId), collateral: await vault.loanCollateral(partial.loanId), lenderBalance: await token.balanceOf(LENDER), reserveUsed: await reserve.reserveUsedByLoan(partial.loanId), reserveProcessed: await reserve.reserveSettlementProcessed(partial.loanId), ltv: await liquidation.currentLtvBps(partial.loanId), request: await market.requests(partial.requestId) };
    const partialEvent = partialTx.record.events.find((row) => row.contract === 'LiquidationV2' && row.event === 'P2PPartialLiquidationExecuted');
    if (!partialEvent || partialAfter.collateral <= 0n || partialAfter.collateral >= partialBefore.collateral || partialAfter.loan[4] <= 0n || partialAfter.loan[14] !== 0n || partialAfter.request[4] !== 1n || partialAfter.ltv > 7000n || partialAfter.reserveUsed !== 0n || partialAfter.reserveProcessed || partialAfter.lenderBalance <= partialBefore.lenderBalance) fail('Scenario B strict partial invariants failed.');
    trace.scenarios.partial = asJson({ requestId: partial.requestId, loanId: partial.loanId, marginCallCureEnd: partialMargin[13], ltvBefore: partialLtvBefore, collateralBefore: partialBefore.collateral, collateralAfter: partialAfter.collateral, remainingDebt: partialAfter.loan[4] + partialAfter.loan[5] + partialAfter.loan[6], ltvAfter: partialAfter.ltv, lenderIncrease: partialAfter.lenderBalance - partialBefore.lenderBalance, reserveUsed: partialAfter.reserveUsed, event: partialEvent });
  }

  // Scenario C: uses a separate high-value fixture loan. The existing local-only mock router rate is changed solely to make its actual sale proceeds lower than debt, while the canonical adapter/validator still controls all liquidation inputs.
  // The live accepted baseline is $800 after Scenario B. Move through the
  // adapter's allowed 100% deviation boundary, then let `syncRisk` record the
  // bridge snapshot before moving to the $2,000 origin price.
  await refreshFeeds(1600n, 'Scenario C deviation-compatible bridge');
  await mine('Scenario C: accept bridge snapshot', liquidation.connect(keeper).syncRisk(partial.loanId));
  await refreshFeeds(2000n, 'Scenario C initial capacity');
  await mine('Scenario C: local mock route rate', router.connect(admin).setRate(100n, 1n));
  const terminal = await createAndFund('Scenario C', parseEther('140000'), parseEther('200'));
  const terminalMargin = await marginCall('Scenario C', terminal.loanId);
  await expectRevert('Scenario C before cure', () => liquidation.connect(keeper).liquidateP2P.staticCall(terminal.loanId), 'p2p liquidation not eligible');
  await setNext(terminalMargin[13] + 1n);
  await expectRevert('Scenario C stale oracle', () => liquidation.connect(keeper).liquidateP2P.staticCall(terminal.loanId), 'stale price');
  await refreshFeeds(1000n, 'Scenario C fresh below-80 check');
  await expectRevert('Scenario C below 80 percent', () => liquidation.connect(keeper).liquidateP2P.staticCall(terminal.loanId), 'p2p liquidation not eligible');
  await refreshFeeds(800n, 'Scenario C invalid route quote');
  await expectRevert('Scenario C invalid quote', () => liquidation.connect(keeper).liquidateP2P.staticCall(terminal.loanId), 'p2p partial quote failed');
  await refreshFeeds(500n, 'Scenario C terminal boundary');
  const terminalBefore = { loan: await manager.getLoan(terminal.loanId), collateral: await vault.loanCollateral(terminal.loanId), lenderBalance: await token.balanceOf(LENDER), reserveBalance: await reserve.availableBalance(), reserveUsed: await reserve.reserveUsedByLoan(terminal.loanId) };
  const terminalLtv = await liquidation.currentLtvBps(terminal.loanId);
  if (terminalLtv < 8000n) fail('Scenario C did not reach the terminal eligibility threshold.');
  const terminalTx = await mine('Scenario C: permissionless terminal P2P liquidation', liquidation.connect(keeper).liquidateP2P(terminal.loanId));
  const terminalAfter = { loan: await manager.getLoan(terminal.loanId), collateral: await vault.loanCollateral(terminal.loanId), lenderBalance: await token.balanceOf(LENDER), reserveBalance: await reserve.availableBalance(), reserveUsed: await reserve.reserveUsedByLoan(terminal.loanId), reserveProcessed: await reserve.reserveSettlementProcessed(terminal.loanId), request: await market.requests(terminal.requestId), certificates: [await nft.loanCertificates(terminal.loanId, 0), await nft.loanCertificates(terminal.loanId, 1), await nft.loanCertificates(terminal.loanId, 2)] };
  const terminalEvent = terminalTx.record.events.find((row) => row.contract === 'LiquidationV2' && row.event === 'P2PTerminalRecoveryExecuted');
  if (!terminalEvent || terminalAfter.collateral !== 0n || terminalAfter.loan[14] !== 7n || terminalAfter.request[4] !== 5n || terminalAfter.loan[17] === 0n || !terminalAfter.reserveProcessed || terminalAfter.reserveUsed === 0n || terminalAfter.reserveUsed > parseEther('100000') || terminalAfter.lenderBalance <= terminalBefore.lenderBalance || terminalAfter.certificates.some((id) => id !== 0n)) fail('Scenario C terminal invariants failed.');
  await expectRevert('Scenario C duplicate liquidation', () => liquidation.connect(keeper).liquidateP2P.staticCall(terminal.loanId), 'not funded p2p loan');
  const reserveAfterDuplicate = await reserve.reserveUsedByLoan(terminal.loanId); const collateralAfterDuplicate = await vault.loanCollateral(terminal.loanId);
  if (reserveAfterDuplicate !== terminalAfter.reserveUsed || collateralAfterDuplicate !== 0n) fail('Scenario C duplicate protections failed.');
  await expectRevert('caller-selected sale execution', () => adapter.connect(keeper).executeSale.staticCall(terminal.loanId, 1n, 1n, 7000), 'only liquidation');
  trace.scenarios.terminal = asJson({ requestId: terminal.requestId, loanId: terminal.loanId, marginCallCureEnd: terminalMargin[13], ltvBefore: terminalLtv, collateralBefore: terminalBefore.collateral, collateralAfter: terminalAfter.collateral, lenderIncrease: terminalAfter.lenderBalance - terminalBefore.lenderBalance, reserveContribution: terminalAfter.reserveUsed, reserveBalanceDecrease: terminalBefore.reserveBalance - terminalAfter.reserveBalance, residualDebt: terminalAfter.loan[17], loanState: terminalAfter.loan[14], requestState: terminalAfter.request[4], certificates: terminalAfter.certificates, routerRate: [await router.rateNumerator(), await router.rateDenominator()], event: terminalEvent });

  // Pause guard is checked after terminal accounting so it cannot affect either recovery.
  await mine('Security: pause LiquidationV2', liquidation.connect(admin).pause());
  await expectRevert('paused P2P adverse recovery', () => liquidation.connect(keeper).liquidateP2P.staticCall(terminal.loanId), 'EnforcedPause');
  await mine('Security: unpause LiquidationV2', liquidation.connect(admin).unpause());

  const finalBlock = await provider.getBlock('latest');
  trace.final = { head: finalBlock.number, headHash: finalBlock.hash, routerRate: [(await router.rateNumerator()).toString(), (await router.rateDenominator()).toString()] };
  fs.writeFileSync(path.join(runtimeDir, 'p2p-adverse-recovery-result.json'), `${JSON.stringify(trace, bigintJson, 2)}\n`);
  console.log(JSON.stringify(trace, bigintJson, 2));
}

main().catch((error) => { console.error(`B5.3.3 failed: ${error.stack || error.message}`); process.exitCode = 1; });
