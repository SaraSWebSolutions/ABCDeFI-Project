/* Disposable B5.3.2 happy-path executor.  Uses only unlocked accounts on the
 * B5.3 R2 Hardhat node; it never accepts a private key or protected RPC. */
const fs = require('node:fs');
const path = require('node:path');
const { Contract, Interface, JsonRpcProvider, keccak256, parseEther, toUtf8Bytes } = require('ethers');
const { loadLendingV2Artifacts } = require('../../config/lendingV2Artifacts.cjs');

const required = (v, n) => { if (!v) throw new Error(`B5.3.2 requires ${n}`); return v; };
const eventNames = (receipt, contract, abi) => receipt.logs.filter((log) => log.address.toLowerCase() === contract.toLowerCase()).flatMap((log) => { try { return [new Interface(abi).parseLog(log).name]; } catch (_) { return []; } });
const metadata = (label) => {
  const make = (role) => { const uri = `ipfs://b53-r2-${label}-${role}`; return { uri, hash: keccak256(toUtf8Bytes(uri)) }; };
  return { lender: make('lender'), borrower: make('borrower'), platform: make('platform') };
};
async function main() {
  const runtime = path.resolve(required(process.env.B53_R2_RUNTIME_DIR, 'B53_R2_RUNTIME_DIR'));
  const lending = JSON.parse(fs.readFileSync(path.join(runtime, 'lending.json'), 'utf8'));
  if (lending.rpcUrl !== 'http://127.0.0.1:8558' || Number(lending.chainId) !== 31337) throw new Error('B5.3.2 refuses a non-R2 RPC.');
  const provider = new JsonRpcProvider(lending.rpcUrl); const network = await provider.getNetwork(); if (Number(network.chainId) !== 31337) throw new Error('B5.3.2 wrong chain.');
  const borrower = await provider.getSigner('0x976EA74026E726554dB657fA54763abd0C3a0aa9');
  const lender = await provider.getSigner('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const borrowerAddress = await borrower.getAddress(); const lenderAddress = await lender.getAddress();
  const artifacts = loadLendingV2Artifacts(); const c = lending.contracts;
  const market = new Contract(c.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi, borrower);
  const token = new Contract(c.ABCDTokenV2.address, ['function approve(address,uint256) returns (bool)', 'function balanceOf(address) view returns (uint256)'], lender);
  const manager = new Contract(c.LoanManagerV2.address, artifacts.LoanManagerV2.abi, provider);
  const emi = new Contract(c.EMIManagerV2.address, artifacts.EMIManagerV2.abi, borrower);
  const vault = new Contract(c.CollateralVaultV2.address, artifacts.CollateralVaultV2.abi, provider);
  const principal = parseEther('70'); const collateral = parseEther('0.1'); const term = 30 * 24 * 60 * 60;
  const requestTx = await market.createRequest(principal, term, { value: collateral }); const requestReceipt = await requestTx.wait();
  const created = new Interface(artifacts.LoanMarketplaceV2.abi).parseLog(requestReceipt.logs.find((log) => log.address.toLowerCase() === c.LoanMarketplaceV2.address.toLowerCase() && log.topics[0] === new Interface(artifacts.LoanMarketplaceV2.abi).getEvent('RequestCreated').topicHash));
  const requestId = created.args.requestId;
  const lenderBalanceBefore = await token.balanceOf(lenderAddress);
  const approveFundingTx = await token.connect(lender).approve(c.LoanMarketplaceV2.address, principal); const approveFundingReceipt = await approveFundingTx.wait();
  const fundingTx = await market.connect(lender).fundRequest(requestId); const fundingReceipt = await fundingTx.wait();
  const marketIface = new Interface(artifacts.LoanMarketplaceV2.abi);
  const funded = marketIface.parseLog(fundingReceipt.logs.find((log) => log.address.toLowerCase() === c.LoanMarketplaceV2.address.toLowerCase() && log.topics[0] === marketIface.getEvent('RequestFunded').topicHash));
  const loanId = funded.args.loanId; const loan = await manager.getLoan(loanId); const scheduled = await emi.totalScheduled(loanId);
  const approveRepaymentTx = await token.connect(borrower).approve(c.EMIManagerV2.address, scheduled); const approveRepaymentReceipt = await approveRepaymentTx.wait();
  await provider.send('evm_setNextBlockTimestamp', [Number(loan.maturity)]); await provider.send('evm_mine', []);
  const lenderBeforeRepayment = await token.balanceOf(lenderAddress);
  const repaymentTx = await emi.payInstallmentWithCompletionMetadata(loanId, metadata('completion')); const repaymentReceipt = await repaymentTx.wait();
  const finalLoan = await manager.getLoan(loanId); const finalRequest = await market.requests(requestId); const finalCollateral = await vault.loanCollateral(loanId); const lenderAfterRepayment = await token.balanceOf(lenderAddress);
  if (!loan.isP2P || finalLoan.state !== 5n || finalRequest.state !== 3n || finalCollateral !== 0n || lenderAfterRepayment <= lenderBeforeRepayment) throw new Error('B5.3.2 final canonical P2P state is invalid.');
  const result = {
    rpc: lending.rpcUrl, chainId: Number(network.chainId), borrower: borrowerAddress, lender: lenderAddress,
    request: { id: requestId.toString(), tx: requestTx.hash, block: requestReceipt.blockNumber, events: eventNames(requestReceipt, c.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi) },
    fundingApproval: { tx: approveFundingTx.hash, block: approveFundingReceipt.blockNumber },
    funding: { loanId: loanId.toString(), tx: fundingTx.hash, block: fundingReceipt.blockNumber, events: eventNames(fundingReceipt, c.LoanMarketplaceV2.address, artifacts.LoanMarketplaceV2.abi) },
    repaymentApproval: { tx: approveRepaymentTx.hash, block: approveRepaymentReceipt.blockNumber },
    repayment: { tx: repaymentTx.hash, block: repaymentReceipt.blockNumber, events: eventNames(repaymentReceipt, c.EMIManagerV2.address, artifacts.EMIManagerV2.abi), totalScheduled: scheduled.toString() },
    final: { loanState: finalLoan.state.toString(), requestState: finalRequest.state.toString(), collateral: finalCollateral.toString(), lenderBalanceIncrease: (lenderAfterRepayment - lenderBeforeRepayment).toString(), isP2P: finalLoan.isP2P, head: await provider.getBlockNumber() },
  };
  fs.writeFileSync(path.join(runtime, 'p2p-happy-path-result.json'), `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => { console.error(`B5.3.2 failed: ${e.stack || e.message}`); process.exitCode = 1; });
