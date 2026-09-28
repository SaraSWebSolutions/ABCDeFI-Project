/*
 * Local-only, persistent-runtime evidence harness for the canonical Direct
 * Lending normal-completion path.  It deliberately reads the active unified
 * manifest from the explicitly supplied E2E runtime directory and never
 * deploys or mutates any manifest.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { ethers } from 'ethers';

const require = createRequire(import.meta.url);
require('dotenv').config({ path: path.resolve('backend/backend/.env') });

const ROOT = process.cwd();
const runtimeDir = path.resolve(process.argv[2] || '.e2e-runtime/oneq-persistence-v1');
const unified = JSON.parse(fs.readFileSync(path.join(runtimeDir, 'manifests', 'unified.json'), 'utf8'));
const lending = JSON.parse(fs.readFileSync(unified.childManifests.lending.path, 'utf8'));
const artifacts = require(path.join(ROOT, 'backend/backend/config/lendingV2Artifacts.cjs')).loadLendingV2Artifacts();
const tokenArtifact = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/contracts/token/ABCDTokenV2.sol/ABCDTokenV2.json'), 'utf8'));
const { completionCertificateMetadata, loadPlatformArtwork } = require(path.join(ROOT, 'backend/backend/modules/lendingV2Metadata/lendingV2Metadata.controller.cjs'));
const { storeNftAsset, readPublicIpfsJson, storageProvider } = require(path.join(ROOT, 'backend/backend/services/nftAssetStorage.cjs'));

const provider = new ethers.JsonRpcProvider(unified.rpcUrl);
let borrower;
const addr = (name) => lending.contracts[name].address;
const token = new ethers.Contract(unified.contracts.ABCDTokenV2.address, tokenArtifact.abi, provider);
const pool = new ethers.Contract(addr('LendingPoolV2'), artifacts.LendingPoolV2.abi, provider);
const manager = new ethers.Contract(addr('LoanManagerV2'), artifacts.LoanManagerV2.abi, provider);
const vault = new ethers.Contract(addr('CollateralVaultV2'), artifacts.CollateralVaultV2.abi, provider);
const nft = new ethers.Contract(addr('LoanNFTV2'), artifacts.LoanNFTV2.abi, provider);
const emi = new ethers.Contract(addr('EMIManagerV2'), artifacts.EMIManagerV2.abi, provider);
const reserve = new ethers.Contract(addr('InsuranceReserveV2'), artifacts.InsuranceReserveV2.abi, provider);

function required(condition, message) { assert.ok(condition, message); }
function parse(receipt, contract, name) {
  const item = receipt.logs.map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } }).find((log) => log?.name === name);
  required(item, `missing ${name}`); return item.args;
}
async function mined(tx, label) {
  const receipt = await tx.wait();
  required(receipt?.status === 1, `${label} reverted`); return receipt;
}
async function uploadMetadata(loanId, loan) {
  required(storageProvider() === 'pinata', 'canonical Pinata provider is not configured');
  const artwork = await loadPlatformArtwork();
  const platform = await nft.platformRecipient();
  const requestId = 0n; // Direct Lending canonical request ID is zero.
  const roles = ['Lender', 'Borrower', 'Platform'];
  const records = {};
  for (const role of roles) {
    const document = completionCertificateMetadata(String(loanId), loan, requestId, platform, role, Number(unified.chainId));
    const stored = await storeNftAsset(artwork, document);
    required(stored.provider === 'pinata' && /^ipfs:\/\/[A-Za-z0-9]+$/.test(stored.metadataUri), `${role} did not produce public Pinata metadata`);
    const readBack = await readPublicIpfsJson(stored.metadataCid);
    const attributes = Object.fromEntries(readBack.attributes.map((item) => [item.trait_type, item.value]));
    required(String(attributes['Loan ID']) === String(loanId), `${role} metadata loan mismatch`);
    required(String(attributes['Chain ID']) === String(unified.chainId), `${role} metadata chain mismatch`);
    required(String(attributes['Certificate role']) === role, `${role} metadata role mismatch`);
    required(String(attributes.Borrower).toLowerCase() === loan.borrower.toLowerCase(), `${role} metadata borrower mismatch`);
    records[role.toLowerCase()] = { uri: stored.metadataUri, hash: ethers.keccak256(ethers.toUtf8Bytes(stored.metadataUri)), cid: stored.metadataCid };
  }
  return records;
}

async function main() {
  required(unified.chainId === 31337, 'manifest chain is not canonical local 31337');
  required(unified.deploymentIdentity === '08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b', 'unexpected deployment identity');
  const network = await provider.getNetwork();
  required(network.chainId === 31337n, 'RPC chain mismatch');
  for (const name of ['ABCDTokenV2', 'LendingPoolV2', 'LoanManagerV2', 'CollateralVaultV2', 'LoanNFTV2', 'EMIManagerV2', 'InsuranceReserveV2']) {
    const address = name === 'ABCDTokenV2' ? unified.contracts[name].address : addr(name);
    required((await provider.getCode(address)) !== '0x', `missing live bytecode for ${name}`);
  }
  borrower = await provider.getSigner('0x15d34aaf54267db7d7c367839aaf71a00a2c6a65');
  required((await borrower.getAddress()).toLowerCase() === '0x15d34aaf54267db7d7c367839aaf71a00a2c6a65', 'unexpected local borrower signer');
  const collateral = ethers.parseEther('0.1');
  const principal = ethers.parseEther('70');
  const term = 30 * 24 * 60 * 60;
  const reserveBefore = await token.balanceOf(await reserve.getAddress());
  const depositReceipt = await mined(await pool.connect(borrower).depositCollateral({ value: collateral }), 'deposit collateral');
  const depositId = parse(depositReceipt, pool, 'CollateralDepositCreated').depositId;
  required((await vault.directDepositCollateral(depositId)) === collateral, 'deposit collateral mismatch');
  const borrowReceipt = await mined(await pool.connect(borrower).borrowABCD(depositId, principal, term), 'borrow ABCD');
  const loanId = parse(borrowReceipt, pool, 'DirectLoanOpened').loanId;
  let loan = await manager.getLoan(loanId);
  required(loan.state === 0n && loan.principal === principal && loan.collateralETH === collateral && loan.aprBps === 925n, 'unexpected active loan terms');
  const schedule = await emi.getSchedule(loanId);
  required(schedule.length === 1 && schedule[0].dueAt === loan.start + BigInt(term), 'unexpected canonical schedule');
  const partialAmount = ethers.parseEther('35');
  required((await pool.outstanding(loanId)) > partialAmount, 'insufficient outstanding for partial normal repayment');
  await mined(await token.connect(borrower).approve(await pool.getAddress(), ethers.MaxUint256), 'approve repayment');
  const partialReceipt = await mined(await pool.connect(borrower).repay(loanId, partialAmount), 'partial normal repayment');
  const partialEvent = parse(partialReceipt, pool, 'DirectLoanRepaid');
  const outstandingBeforeFinal = await pool.outstanding(loanId);
  required(outstandingBeforeFinal > 0n && (await manager.getLoan(loanId)).state === 0n, 'partial repayment did not preserve ACTIVE loan');
  const metadata = await uploadMetadata(loanId, await manager.getLoan(loanId));
  const finalReceipt = await mined(await pool.connect(borrower).repayAllWithCompletionMetadata(loanId, {
    lender: { uri: metadata.lender.uri, hash: metadata.lender.hash },
    borrower: { uri: metadata.borrower.uri, hash: metadata.borrower.hash },
    platform: { uri: metadata.platform.uri, hash: metadata.platform.hash },
  }), 'terminal repayment with completion metadata');
  const finalEvent = parse(finalReceipt, pool, 'DirectLoanRepaid');
  loan = await manager.getLoan(loanId);
  required(loan.state === 1n && loan.principalOutstanding === 0n, 'terminal repayment did not reach REPAID');
  const certificates = [];
  for (const role of [0, 1, 2]) {
    const tokenId = await nft.loanCertificates(loanId, role);
    required(tokenId > 0n, `missing certificate role ${role}`);
    const certificate = await nft.getCertificate(tokenId);
    certificates.push({ role, tokenId: tokenId.toString(), owner: await nft.ownerOf(tokenId), tokenURI: await nft.tokenURI(tokenId), metadataHash: certificate.metadataHash, completionBlock: certificate.completionBlock.toString(), value: certificate.certificateValue.toString(), valuationFeed: certificate.valuationFeed });
  }
  required(new Set(certificates.map((item) => item.tokenId)).size === 3, 'completion certificates are not exactly role-specific');
  const withdrawalReceipt = await mined(await pool.connect(borrower).withdrawSettledCollateral(loanId), 'withdraw settled collateral');
  required((await manager.getLoan(loanId)).state === 5n && (await vault.loanCollateral(loanId)) === 0n, 'settled withdrawal did not close loan');
  let duplicate = false;
  try { await pool.withdrawSettledCollateral.staticCall(loanId); } catch { duplicate = true; }
  required(duplicate, 'duplicate settled withdrawal did not fail closed');
  let duplicateCompletion = false;
  try { await nft.connect(borrower).mintCompletionCertificates.staticCall(loanId, 0, false, { lender: { uri: metadata.lender.uri, hash: metadata.lender.hash }, borrower: { uri: metadata.borrower.uri, hash: metadata.borrower.hash }, platform: { uri: metadata.platform.uri, hash: metadata.platform.hash } }); } catch { duplicateCompletion = true; }
  required(duplicateCompletion, 'duplicate completion mint did not fail closed');
  const evidence = { runtime: { chainId: network.chainId.toString(), deploymentIdentity: unified.deploymentIdentity, startingBlock: depositReceipt.blockNumber }, deposit: { id: depositId.toString(), hash: depositReceipt.hash, block: depositReceipt.blockNumber }, borrow: { loanId: loanId.toString(), hash: borrowReceipt.hash, block: borrowReceipt.blockNumber }, active: { principal: principal.toString(), collateral: collateral.toString(), aprBps: loan.aprBps.toString(), dueAt: schedule[0].dueAt.toString() }, partialRepayment: { amount: partialAmount.toString(), hash: partialReceipt.hash, block: partialReceipt.blockNumber, fee: partialEvent.fee?.toString?.() ?? null, interest: partialEvent.interest?.toString?.() ?? null, principal: partialEvent.principal?.toString?.() ?? null }, finalRepayment: { amount: outstandingBeforeFinal.toString(), hash: finalReceipt.hash, block: finalReceipt.blockNumber, fee: finalEvent.fee?.toString?.() ?? null, interest: finalEvent.interest?.toString?.() ?? null, principal: finalEvent.principal?.toString?.() ?? null, metadata }, withdrawal: { hash: withdrawalReceipt.hash, block: withdrawalReceipt.blockNumber }, finalState: (await manager.getLoan(loanId)).state.toString(), reserveBefore: reserveBefore.toString(), reserveAfter: (await token.balanceOf(await reserve.getAddress())).toString(), certificates, replay: { duplicateWithdrawalRejected: duplicate, duplicateCompletionRejected: duplicateCompletion } };
  fs.writeFileSync(path.join(runtimeDir, 'normal-direct-lending-e2e-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
