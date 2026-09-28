/* Local-only evidence harness for the deployed LendingReferralManagerV2. */
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
const address = (name) => lending.contracts[name].address;
const token = new ethers.Contract(unified.contracts.ABCDTokenV2.address, tokenArtifact.abi, provider);
const pool = new ethers.Contract(address('LendingPoolV2'), artifacts.LendingPoolV2.abi, provider);
const manager = new ethers.Contract(address('LoanManagerV2'), artifacts.LoanManagerV2.abi, provider);
const vault = new ethers.Contract(address('CollateralVaultV2'), artifacts.CollateralVaultV2.abi, provider);
const referral = new ethers.Contract(address('LendingReferralManagerV2'), artifacts.LendingReferralManagerV2.abi, provider);
const nft = new ethers.Contract(address('LoanNFTV2'), artifacts.LoanNFTV2.abi, provider);
const emi = new ethers.Contract(address('EMIManagerV2'), artifacts.EMIManagerV2.abi, provider);

function required(value, message) { assert.ok(value, message); }
async function mined(tx, label) { const receipt = await tx.wait(); required(receipt?.status === 1, `${label} reverted`); return receipt; }
function event(receipt, contract, name) { const found = receipt.logs.map((log) => { try { return contract.interface.parseLog(log); } catch { return null; } }).find((item) => item?.name === name); required(found, `missing ${name}`); return found.args; }
async function uploadLoanCompletion(loanId, loan) {
  required(storageProvider() === 'pinata', 'Pinata/IPFS is not configured');
  const artwork = await loadPlatformArtwork(); const platform = await nft.platformRecipient(); const result = {};
  for (const role of ['Lender', 'Borrower', 'Platform']) {
    const document = completionCertificateMetadata(String(loanId), loan, 0n, platform, role, Number(unified.chainId));
    const stored = await storeNftAsset(artwork, document); const returned = await readPublicIpfsJson(stored.metadataCid);
    const attrs = Object.fromEntries(returned.attributes.map((item) => [item.trait_type, item.value]));
    required(String(attrs['Loan ID']) === String(loanId) && String(attrs['Certificate role']) === role, `invalid ${role} completion metadata`);
    result[role.toLowerCase()] = { uri: stored.metadataUri, hash: ethers.keccak256(ethers.toUtf8Bytes(stored.metadataUri)), cid: stored.metadataCid };
  }
  return result;
}
async function uploadReferralCertificate(loanId, referrerAddress, borrowerAddress) {
  const artwork = await loadPlatformArtwork();
  const document = {
    name: `ABCDeFi Lending Referral Certificate — Loan #${loanId}`,
    description: 'On-chain non-transferable LendingReferralManagerV2 accounting certificate.',
    attributes: [
      { trait_type: 'Protocol', value: 'ABCDeFi LendingReferralManagerV2' },
      { trait_type: 'Loan ID', value: String(loanId) },
      { trait_type: 'Referrer', value: referrerAddress },
      { trait_type: 'Referred borrower', value: borrowerAddress },
      { trait_type: 'Certificate value basis', value: '0.5% of originated principal' },
      { trait_type: 'Transferability', value: 'Non-transferable by current contract' },
    ],
  };
  const stored = await storeNftAsset(artwork, document); const returned = await readPublicIpfsJson(stored.metadataCid);
  required(returned.name === document.name, 'referral certificate public read-back failed');
  return { uri: stored.metadataUri, hash: ethers.keccak256(ethers.toUtf8Bytes(stored.metadataUri)), cid: stored.metadataCid };
}

async function main() {
  required(unified.chainId === 31337 && unified.deploymentIdentity === '08af1c8d48ebfb5a9424097780192c3d40b430205b59d0622079e6659504d34b', 'wrong 1Q runtime family');
  required((await provider.getNetwork()).chainId === 31337n, 'wrong RPC chain');
  for (const contractName of ['ABCDTokenV2', 'LendingPoolV2', 'LoanManagerV2', 'LendingReferralManagerV2', 'LoanNFTV2']) {
    const deployed = contractName === 'ABCDTokenV2' ? unified.contracts[contractName].address : address(contractName);
    required((await provider.getCode(deployed)) !== '0x', `missing bytecode: ${contractName}`);
  }
  const accounts = await provider.send('eth_accounts', []);
  const borrower = await provider.getSigner(accounts[6]);
  const referrer = await provider.getSigner(accounts[7]);
  const selfAccount = await provider.getSigner(accounts[8]);
  const borrowerAddress = await borrower.getAddress(); const referrerAddress = await referrer.getAddress(); const selfAddress = await selfAccount.getAddress();
  required(await referral.referrerOf(borrowerAddress) === ethers.ZeroAddress, 'borrower test identity already bound');
  const marketing = lending.allocations.marketing; const rewardVault = await referral.rewardVault();
  required(rewardVault.toLowerCase() === marketing.toLowerCase(), 'reward vault does not bind to canonical marketing allocation');
  required((await token.balanceOf(marketing)) >= ethers.parseEther('0.035') && (await token.allowance(marketing, await referral.getAddress())) >= ethers.parseEther('0.035'), 'marketing funding/allowance insufficient');
  const refCode = `E2E-REF-${(await provider.getBlockNumber())}`; const selfCode = `E2E-SELF-${(await provider.getBlockNumber())}`;
  const createCodeReceipt = await mined(await referral.connect(referrer).createReferralCode(refCode), 'create referral code');
  const bindReceipt = await mined(await referral.connect(borrower).bindReferrer(refCode), 'bind borrower referrer');
  await mined(await referral.connect(selfAccount).createReferralCode(selfCode), 'create self-test referral code');
  let selfReferralRejected = false; let duplicateBindingRejected = false;
  try { await referral.connect(selfAccount).bindReferrer.staticCall(selfCode); } catch { selfReferralRejected = true; }
  try { await referral.connect(borrower).bindReferrer.staticCall(refCode); } catch { duplicateBindingRejected = true; }
  required(selfReferralRejected && duplicateBindingRejected, 'referral binding negative protection missing');
  const collateral = ethers.parseEther('0.1'); const principal = ethers.parseEther('70'); const term = 30 * 24 * 60 * 60;
  const depositReceipt = await mined(await pool.connect(borrower).depositCollateral({ value: collateral }), 'referral loan deposit');
  const depositId = event(depositReceipt, pool, 'CollateralDepositCreated').depositId;
  const borrowReceipt = await mined(await pool.connect(borrower).borrowABCD(depositId, principal, term), 'referral loan borrow');
  const loanId = event(borrowReceipt, pool, 'DirectLoanOpened').loanId;
  const registration = event(borrowReceipt, referral, 'LendingReferralRegistered');
  let loan = await manager.getLoan(loanId); const schedule = await emi.getSchedule(loanId);
  required(loan.state === 0n && schedule.length === 1 && registration.referrer.toLowerCase() === referrerAddress.toLowerCase() && registration.referred.toLowerCase() === borrowerAddress.toLowerCase(), 'active referral loan registration mismatch');
  const recordBefore = await referral.getLoanReferral(loanId, borrowerAddress);
  required(recordBefore.monthlyReward === ethers.parseEther('0.035') && recordBefore.paidPeriods === 0n, 'monthly referral reward mismatch');
  let earlyClaimRejected = false;
  try { await referral.connect(referrer).claimAccruedReward.staticCall(loanId, borrowerAddress); } catch { earlyClaimRejected = true; }
  required(earlyClaimRejected, 'pre-completion payout was available');
  await provider.send('evm_setNextBlockTimestamp', [Number(schedule[0].dueAt)]); await provider.send('evm_mine', []);
  const dueBlock = await provider.getBlock('latest'); required(BigInt(dueBlock.timestamp) >= schedule[0].dueAt, 'time did not reach referral period boundary');
  await mined(await token.connect(borrower).approve(await pool.getAddress(), ethers.MaxUint256), 'approve scheduled repayment');
  const completion = await uploadLoanCompletion(loanId, await manager.getLoan(loanId));
  const repaymentReceipt = await mined(await pool.connect(borrower).payDirectInstallmentWithCompletionMetadata(loanId, {
    lender: { uri: completion.lender.uri, hash: completion.lender.hash }, borrower: { uri: completion.borrower.uri, hash: completion.borrower.hash }, platform: { uri: completion.platform.uri, hash: completion.platform.hash },
  }), 'scheduled terminal repayment');
  required((await manager.getLoan(loanId)).state === 1n, 'scheduled repayment did not reach REPAID');
  const withdrawalReceipt = await mined(await pool.connect(borrower).withdrawSettledCollateral(loanId), 'complete referral loan close');
  loan = await manager.getLoan(loanId); const recordClosed = await referral.getLoanReferral(loanId, borrowerAddress);
  required(loan.state === 5n && recordClosed.completedAt > 0n, 'closed referral loan completion was not recorded');
  const rewardBefore = await token.balanceOf(referrerAddress);
  const claimReceipt = await mined(await referral.connect(referrer).claimAccruedReward(loanId, borrowerAddress), 'claim completed referral reward');
  const rewardEvent = event(claimReceipt, referral, 'LendingReferralRewardPaid');
  const recordPaid = await referral.getLoanReferral(loanId, borrowerAddress);
  required((await token.balanceOf(referrerAddress)) - rewardBefore === ethers.parseEther('0.035'), 'reward transfer mismatch');
  required(recordPaid.paidPeriods === 1n && recordPaid.totalRewards === ethers.parseEther('0.035'), 'paid referral accounting mismatch');
  let duplicateClaimRejected = false;
  try { await referral.connect(referrer).claimAccruedReward.staticCall(loanId, borrowerAddress); } catch { duplicateClaimRejected = true; }
  required(duplicateClaimRejected, 'duplicate reward claim was not rejected');
  const certificateMetadata = await uploadReferralCertificate(loanId, referrerAddress, borrowerAddress);
  const mintReceipt = await mined(await referral.connect(referrer).mintReferralCertificate(loanId, borrowerAddress, certificateMetadata.uri, certificateMetadata.hash), 'mint referral certificate');
  const minted = event(mintReceipt, referral, 'LendingReferralCertificateMinted'); const certificate = await referral.getReferralCertificate(minted.tokenId);
  required(certificate.value === ethers.parseEther('0.35') && (await referral.ownerOf(minted.tokenId)).toLowerCase() === referrerAddress.toLowerCase(), 'referral certificate accounting/ownership mismatch');
  let duplicateCertificateRejected = false; let transferRejected = false; let unauthorizedRegisterRejected = false;
  try { await referral.connect(referrer).mintReferralCertificate.staticCall(loanId, borrowerAddress, certificateMetadata.uri, certificateMetadata.hash); } catch { duplicateCertificateRejected = true; }
  try { await referral.connect(referrer).transferFrom.staticCall(referrerAddress, borrowerAddress, minted.tokenId); } catch { transferRejected = true; }
  try { await referral.connect(borrower).registerLoan.staticCall(loanId, 0, false); } catch { unauthorizedRegisterRejected = true; }
  required(duplicateCertificateRejected && transferRejected && unauthorizedRegisterRejected, 'referral certificate or operator protections missing');
  const evidence = {
    runtime: { chainId: '31337', deploymentIdentity: unified.deploymentIdentity, startingBlock: createCodeReceipt.blockNumber, referral: await referral.getAddress(), rewardVault, marketing },
    identities: { borrower: borrowerAddress, referrer: referrerAddress, selfTest: selfAddress },
    code: { value: refCode, createHash: createCodeReceipt.hash, block: createCodeReceipt.blockNumber, bindHash: bindReceipt.hash, blockBound: bindReceipt.blockNumber },
    negatives: { selfReferralRejected, duplicateBindingRejected, earlyClaimRejected, duplicateClaimRejected, duplicateCertificateRejected, transferRejected, unauthorizedRegisterRejected },
    loan: { loanId: loanId.toString(), depositId: depositId.toString(), depositHash: depositReceipt.hash, depositBlock: depositReceipt.blockNumber, borrowHash: borrowReceipt.hash, borrowBlock: borrowReceipt.blockNumber, principal: principal.toString(), collateral: collateral.toString(), dueAt: schedule[0].dueAt.toString() },
    completion: { repaymentHash: repaymentReceipt.hash, repaymentBlock: repaymentReceipt.blockNumber, withdrawalHash: withdrawalReceipt.hash, withdrawalBlock: withdrawalReceipt.blockNumber, loanState: loan.state.toString(), loanNftMetadata: completion },
    reward: { claimHash: claimReceipt.hash, claimBlock: claimReceipt.blockNumber, monthlyReward: recordBefore.monthlyReward.toString(), paidPeriods: recordPaid.paidPeriods.toString(), totalRewards: recordPaid.totalRewards.toString(), eventAmount: rewardEvent.amount.toString(), eventPeriod: rewardEvent.period.toString() },
    referralCertificate: { mintHash: mintReceipt.hash, mintBlock: mintReceipt.blockNumber, tokenId: minted.tokenId.toString(), owner: await referral.ownerOf(minted.tokenId), value: certificate.value.toString(), uri: certificateMetadata.uri, hash: certificateMetadata.hash },
  };
  fs.writeFileSync(path.join(runtimeDir, 'referral-e2e-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify(evidence, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
