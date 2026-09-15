/**
 * Local Phase 1 application-service E2E.
 *
 * This deliberately exercises the same frontend V2 service functions used by
 * LendingV2.tsx, with an EIP-1193 adapter backed by unlocked Hardhat-local
 * accounts. It is not a browser or MetaMask test and says so in its result.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { clearWalletCache, connectWallet } from "../src/Services/wallet";
import {
  createV2Request,
  executeV2OverdueEmi,
  fundV2Request,
  getV2Loan,
  getV2Request,
  getV2WalletHistory,
  liquidateV2,
  payV2Emi,
  syncV2LoanRisk,
  type V2Progress,
} from "../src/Services/lendingV2";
import manifest from "../deployments.json";

const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const artifactAbi = (artifactPath: string) =>
  JSON.parse(readFileSync(artifactPath, "utf8")).abi as ethers.InterfaceAbi;

const TOKEN_ABI = artifactAbi("artifacts/contracts/token/ABCDToken.sol/ABCDToken.json");
const MARKET_ABI = artifactAbi("artifacts/contracts/lending/v2/LoanMarketplaceV2.sol/LoanMarketplaceV2.json");
const MANAGER_ABI = artifactAbi("artifacts/contracts/lending/v2/LoanManagerV2.sol/LoanManagerV2.json");
const VAULT_ABI = artifactAbi("artifacts/contracts/lending/v2/CollateralVaultV2.sol/CollateralVaultV2.json");
const LIQUIDATION_ABI = artifactAbi("artifacts/contracts/lending/v2/LiquidationV2.sol/LiquidationV2.json");
const EMI_ABI = artifactAbi("artifacts/contracts/lending/v2/EMIManagerV2.sol/EMIManagerV2.json");
const FEED_ABI = artifactAbi("artifacts/contracts/mocks/MockAggregatorV3V2.sol/MockAggregatorV3V2.json");

const DAY = 86_400;
const UNIT = 10n ** 18n;

type Trace = { action: string; stages: V2Progress[]; hash?: string; block?: string };
const traces: Trace[] = [];

function progress(action: string) {
  const trace: Trace = { action, stages: [] };
  traces.push(trace);
  return (state: V2Progress) => {
    trace.stages.push(state);
    if (state.hash) trace.hash = state.hash;
    if (state.blockNumber) trace.block = state.blockNumber;
  };
}

async function main() {
  assert.equal(manifest.chainId, "31337");
  assert.equal(manifest.lendingV2?.chainId, "31337");
  // The application services use the public manifest RPC. Use that identical
  // JSON-RPC endpoint here; `network.connect()` can otherwise create a
  // simulated in-process network whose clock/feed values differ from the node
  // the frontend is exercising.
  const provider = new ethers.JsonRpcProvider(LOCAL_RPC_URL);
  const accounts = await provider.send("eth_accounts", []) as string[];
  assert.ok(accounts.length >= 12, "Hardhat local node must expose funded test accounts");
  const [adminAddress] = accounts;
  const borrowerAddress = accounts[9];
  const lenderAddress = accounts[10];
  const keeperAddress = accounts[11];
  const admin = await provider.getSigner(adminAddress);
  const borrower = await provider.getSigner(borrowerAddress);
  const lender = await provider.getSigner(lenderAddress);
  const keeper = await provider.getSigner(keeperAddress);
  let selected = borrowerAddress;

  const eip1193 = {
    request: async ({ method, params = [] }: { method: string; params?: unknown[] }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") return [selected];
      return provider.send(method, params as any[]);
    },
  };
  (globalThis as any).window = { ethereum: eip1193 };
  // Browser code intentionally uses Vite's relative `/api` proxy. Node's
  // fetch has no document base URL, so preserve that same route explicitly in
  // this local harness instead of replacing an application API call with a
  // direct database read.
  const nativeFetch = globalThis.fetch.bind(globalThis);
  (globalThis as any).fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" && input.startsWith("/")
      ? `http://127.0.0.1:5000${input}`
      : input;
    return nativeFetch(url, init);
  };

  const addresses = manifest.lendingV2!.contracts;
  const token = new ethers.Contract(manifest.contracts.ABCDToken.address, TOKEN_ABI, provider);
  const market = new ethers.Contract(addresses.LoanMarketplaceV2.address, MARKET_ABI, provider);
  const manager = new ethers.Contract(addresses.LoanManagerV2.address, MANAGER_ABI, provider);
  const vault = new ethers.Contract(addresses.CollateralVaultV2.address, VAULT_ABI, provider);
  const liquidation = new ethers.Contract(addresses.LiquidationV2.address, LIQUIDATION_ABI, provider);
  const emi = new ethers.Contract(addresses.EMIManagerV2.address, EMI_ABI, provider);
  const ethFeed = new ethers.Contract(addresses.MockAggregatorV3V2_ETH_USD.address, FEED_ABI, provider);
  const abcdFeed = new ethers.Contract(addresses.MockAggregatorV3V2_ABCD_USD.address, FEED_ABI, provider);
  const liquidityAddress = await token.liquidityWallet() as string;
  const liquidityWallet = await provider.getSigner(liquidityAddress);

  const switchAccount = async (address: string) => {
    selected = address;
    clearWalletCache();
    const wallet = await connectWallet();
    assert.equal(wallet.chainId, 31337n);
    assert.equal(wallet.address.toLowerCase(), address.toLowerCase());
  };
  const mined = async (tx: any, label: string) => {
    const receipt = await tx.wait();
    assert.equal(receipt?.status, 1, `${label} receipt failed`);
    return receipt;
  };
  // Local time is advanced below. Refresh both feeds together so a test never
  // mistakes the adapter's deliberate stale-price rejection for a flow bug.
  const setOraclePrices = async (ethUsd: bigint) => {
    await mined(await ethFeed.connect(admin).setAnswer(ethUsd * 10n ** 8n), `ETH/USD ${ethUsd}`);
    await mined(await abcdFeed.connect(admin).setAnswer(1n * 10n ** 8n), "ABCD/USD 1");
  };
  const fundActor = async (recipient: string, amount: bigint) => {
    if (await token.balanceOf(recipient) >= amount) return;
    await mined(await token.connect(liquidityWallet).transfer(recipient, amount), "local ABCD setup funding");
  };
  const noCompletionMetadata = async () => { throw new Error("Completion metadata must not be requested for a non-terminal test installment."); };
  const advanceReadableChainTimeTo = async (timestamp: number) => {
    // `eth_call` used by the frontend preview runs against the latest *mined*
    // block. Mine after setting time so its due-date preflight and its eventual
    // transaction observe the same canonical chain clock.
    await provider.send("evm_setNextBlockTimestamp", [timestamp]);
    await provider.send("evm_mine", []);
  };
  const createOrReuseOpenRequest = async (action: string) => {
    // A prior interrupted local-only runner may already have mined the request
    // through the same frontend service. Reuse only an exact, canonical open
    // request for this harness account rather than producing duplicate loans.
    const nextRequestId = await market.nextRequestId() as bigint;
    for (let requestId = 1n; requestId < nextRequestId; requestId += 1n) {
      const request = await market.requests(requestId);
      if (
        request.borrower.toLowerCase() === borrowerAddress.toLowerCase()
        && request.state === 0n
        && request.principal === 70n * UNIT
        && request.collateralETH === ethers.parseEther("0.1")
        && request.termSeconds === 90n * BigInt(DAY)
      ) {
        traces.push({ action: `${action} (reused exact open request)`, stages: [] });
        return requestId.toString();
      }
    }
    const result = await createV2Request("70", "0.1", 90, progress(action));
    assert.ok(result.requestId, "frontend service did not recover RequestCreated request ID");
    return result.requestId!;
  };

  if (process.env.PHASE1_VERIFY_ONLY === "1") {
    const nextRequestId = await market.nextRequestId() as bigint;
    let requestId: string | null = null;
    let loanId: string | null = null;
    for (let id = nextRequestId - 1n; id >= 1n; id -= 1n) {
      const request = await market.requests(id);
      if (request.borrower.toLowerCase() === borrowerAddress.toLowerCase() && request.loanId !== 0n) {
        requestId = id.toString(); loanId = request.loanId.toString(); break;
      }
    }
    assert.ok(requestId && loanId, "No canonical P2P request exists for application/API verification.");
    const [frontendLoan, frontendRequest, history, apiLoanResponse, apiRequestResponse] = await Promise.all([
      getV2Loan(loanId), getV2Request(requestId), getV2WalletHistory(borrowerAddress),
      fetch(`http://127.0.0.1:5000/api/lending-v2/loans/${loanId}`),
      fetch(`http://127.0.0.1:5000/api/lending-v2/requests/${requestId}`),
    ]);
    assert.equal(apiLoanResponse.status, 200); assert.equal(apiRequestResponse.status, 200);
    const [apiLoan, apiRequest] = await Promise.all([apiLoanResponse.json() as Promise<any>, apiRequestResponse.json() as Promise<any>]);
    assert.equal(frontendLoan.borrower.toLowerCase(), borrowerAddress.toLowerCase());
    assert.equal(frontendRequest.requestId, requestId);
    assert.equal(history.status, "AVAILABLE");
    // The single-loan endpoint keys the canonical loan by its requested path;
    // its payload is the raw LoanManager tuple. The request endpoint exposes
    // the request ID at the envelope level and its raw marketplace tuple.
    assert.equal(String(apiLoan.data.loan.borrower).toLowerCase(), borrowerAddress.toLowerCase());
    assert.equal(String(apiRequest.data.requestId), requestId);
    assert.equal(String(apiRequest.data.request.loanId), loanId);
    console.log(JSON.stringify({
      status: "PASS",
      mode: "local-frontend-service-plus-Vite-equivalent-API-proxy (not browser, not MetaMask)",
      requestId, loanId,
      contract: { state: frontendLoan.state, outstanding: frontendLoan.outstanding, collateralETH: frontendLoan.collateralETH, ltvBps: frontendLoan.ltvBps },
      api: { loanSource: apiLoan.source?.kind, requestSource: apiRequest.source?.kind, historyEvents: history.events.length },
    }, null, 2));
    return;
  }

  await setOraclePrices(2_000n);
  await fundActor(lenderAddress, 500n * UNIT);
  await fundActor(keeperAddress, 500n * UNIT);

  // Request 1: application-service request, fund, and ordinary non-terminal EMI.
  await switchAccount(borrowerAddress);
  const borrowerBeforeFunding = await token.balanceOf(borrowerAddress);
  const requestOne = await createOrReuseOpenRequest("create request");
  const created = await getV2Request(requestOne);
  assert.equal(created.state, 0);
  assert.equal(created.principal, "70.0");
  assert.equal(created.collateralETH, "0.1");
  assert.equal(created.initialLtvBps, "3500");
  assert.equal(await vault.requestCollateral(requestOne), ethers.parseEther("0.1"));

  await switchAccount(lenderAddress);
  const fundOneTx = await fundV2Request(requestOne, progress("fund request"));
  assert.ok(fundOneTx.loanId, "frontend service did not recover funded loan ID");
  const loanOne = fundOneTx.loanId!;
  const loanOneChain = await manager.getLoan(loanOne);
  assert.equal(loanOneChain.borrower.toLowerCase(), borrowerAddress.toLowerCase());
  assert.equal(loanOneChain.lender.toLowerCase(), lenderAddress.toLowerCase());
  assert.equal(loanOneChain.principal, 70n * UNIT);
  assert.equal(loanOneChain.aprBps, 925n);
  assert.equal(await vault.requestCollateral(requestOne), 0n);
  assert.equal(await vault.loanCollateral(loanOne), ethers.parseEther("0.1"));
  assert.equal(await token.balanceOf(borrowerAddress), borrowerBeforeFunding + 70n * UNIT);

  const scheduleOne = await emi.getSchedule(loanOne);
  assert.equal(scheduleOne.length, 3, "90-day request must create a three-installment schedule");
  await provider.send("evm_setNextBlockTimestamp", [Number(scheduleOne[0].dueAt)]);
  await switchAccount(borrowerAddress);
  const lenderBeforeEmi = await token.balanceOf(lenderAddress);
  await payV2Emi(loanOne, noCompletionMetadata, progress("ordinary EMI payment"));
  assert.equal(await emi.nextInstallment(loanOne), 1n);
  assert.equal(await token.balanceOf(lenderAddress), lenderBeforeEmi + scheduleOne[0].amount);

  // Request 2: prove the UI-service boundary is fail-closed instead of
  // carrying out a whitepaper-undefined overdue collateral deduction.
  await setOraclePrices(2_000n);
  await switchAccount(borrowerAddress);
  const requestTwo = await createOrReuseOpenRequest("create overdue request");
  await switchAccount(lenderAddress);
  const fundTwoTx = await fundV2Request(requestTwo, progress("fund overdue request"));
  assert.ok(fundTwoTx.loanId);
  const loanTwo = fundTwoTx.loanId!;
  await switchAccount(keeperAddress);
  await assert.rejects(
    () => executeV2OverdueEmi(loanTwo, noCompletionMetadata, progress("early overdue attempt")),
    /overdue collateral settlement is blocked/i,
  );
  const lenderBeforeOverdue = await token.balanceOf(lenderAddress);
  const collateralBeforeOverdue = await vault.loanCollateral(loanTwo);
  assert.equal(await emi.nextInstallment(loanTwo), 0n);
  assert.equal(await token.balanceOf(lenderAddress), lenderBeforeOverdue);
  assert.equal(await vault.loanCollateral(loanTwo), collateralBeforeOverdue);

  // Request 3: retain the specified margin-call state, but reject a partial
  // sale until the whitepaper-undefined sale and residual-settlement rules are approved.
  await setOraclePrices(2_000n);
  await switchAccount(borrowerAddress);
  const requestThreeTx = await createV2Request("70", "0.1", 90, progress("create liquidation request"));
  assert.ok(requestThreeTx.requestId);
  const requestThree = requestThreeTx.requestId!;
  await switchAccount(lenderAddress);
  const fundThreeTx = await fundV2Request(requestThree, progress("fund liquidation request"));
  assert.ok(fundThreeTx.loanId);
  const loanThree = fundThreeTx.loanId!;

  await setOraclePrices(1_000n);
  await switchAccount(keeperAddress);
  await syncV2LoanRisk(loanThree, progress("margin-call synchronization"));
  const marginLoan = await manager.getLoan(loanThree);
  assert.equal(marginLoan.state, 6n, "70% P2P LTV must activate margin call");
  assert.equal(marginLoan.marginCallCureEnd - marginLoan.marginCallAt, 72n * 60n * 60n);

  await advanceReadableChainTimeTo(Number(marginLoan.marginCallCureEnd) + 1);
  await setOraclePrices(800n);
  const loanThreeBefore = await manager.previewOutstanding(loanThree);
  const collateralThreeBefore = await vault.loanCollateral(loanThree);
  await assert.rejects(() => liquidateV2(loanThree, progress("P2P partial liquidation")), /partial liquidation is blocked/i);
  const loanThreeAfter = await manager.getLoan(loanThree);
  const collateralThreeAfter = await vault.loanCollateral(loanThree);
  assert.equal(loanThreeAfter.state, 6n, "blocked P2P settlement must preserve the active margin-call state");
  assert.equal(await manager.previewOutstanding(loanThree), loanThreeBefore);
  assert.equal(collateralThreeAfter, collateralThreeBefore);
  assert.equal((await market.requests(requestThree)).state, 1n, "blocked P2P settlement must preserve the funded request");

  // The backend/indexer must project the actual chain evidence for these UI-service transactions.
  const waitForIndexed = async (requestId: string, loanId: string) => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:5000/api/lending-v2/requests/${requestId}`);
      if (response.ok) {
        const body = await response.json() as any;
        if (body.status === "AVAILABLE" && body.data?.request?.loanId === loanId) return body;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Indexer/API did not project request ${requestId} and loan ${loanId}.`);
  };
  const apiRequest = await waitForIndexed(requestThree, loanThree);
  assert.equal(String(apiRequest.data.request.loanId), loanThree);
  const apiLoanResponse = await fetch(`http://127.0.0.1:5000/api/lending-v2/loans/${loanThree}`);
  assert.equal(apiLoanResponse.status, 200);
  const apiLoan = await apiLoanResponse.json() as any;
  assert.equal(String(apiLoan.data.loan.borrower).toLowerCase(), borrowerAddress.toLowerCase());
  assert.equal(String(apiLoan.data.loan.lender).toLowerCase(), lenderAddress.toLowerCase());

  const frontendRead = await getV2Loan(loanThree);
  assert.equal(frontendRead.borrower.toLowerCase(), borrowerAddress.toLowerCase());
  assert.equal(frontendRead.lender.toLowerCase(), lenderAddress.toLowerCase());
  assert.equal(frontendRead.state, 6);
  let walletHistory: Awaited<ReturnType<typeof getV2WalletHistory>> | undefined;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    walletHistory = await getV2WalletHistory(borrowerAddress);
    if (walletHistory.status === "AVAILABLE" && walletHistory.requests.some((request) => request.requestId === requestThree)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(walletHistory, "wallet history must be returned by the canonical indexer");
  assert.equal(walletHistory.status, "AVAILABLE");
  assert.ok(walletHistory.requests.some((request) => request.requestId === requestThree), "wallet history must catch up with the indexed request");

  console.log(JSON.stringify({
    status: "PASS",
    mode: "local-frontend-service-eip1193-adapter (not browser, not MetaMask)",
    requestIds: { ordinary: requestOne, overduePolicyBlocked: requestTwo, partialLiquidationPolicyBlocked: requestThree },
    loanIds: { ordinary: loanOne, overduePolicyBlocked: loanTwo, partialLiquidationPolicyBlocked: loanThree },
    traces,
    final: {
      blockedPartialLoanState: loanThreeAfter.state.toString(),
      blockedPartialOutstanding: (await manager.previewOutstanding(loanThree)).toString(),
      blockedPartialCollateral: collateralThreeAfter.toString(),
      blockedPartialLtvBps: (await liquidation.currentLtvBps(loanThree)).toString(),
      apiSource: apiLoan.source?.kind,
    },
    finalSettlement: "BLOCKED: P2P partial sale, collateral-deduction, and recovery policy remain whitepaper-undefined; no collateral was seized and no URI/CID/hash was fabricated.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
