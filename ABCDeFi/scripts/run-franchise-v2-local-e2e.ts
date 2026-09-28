import { network } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST_PATH = path.resolve(process.env.FRANCHISE_V2_MANIFEST_PATH || 'deployments.franchise-v2-local.json');
const REPORT_PATH = path.resolve(process.env.FRANCHISE_V2_E2E_REPORT_PATH || 'franchise-v2-local-e2e-report.json');
const receiptEvidence = async (transaction: any, label: string) => { const receipt = await transaction.wait(); if (!receipt || receipt.status !== 1) throw new Error(`${label} failed.`); return { label, transactionHash: transaction.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), logCount: receipt.logs.length }; };
const transferRequestIdFromReceipt = (legion: any, receipt: any) => {
  for (const log of receipt.logs) {
    try {
      const parsed = legion.interface.parseLog(log);
      if (parsed?.name === 'TransferRequested') return parsed.args.requestId;
    } catch {}
  }
  throw new Error('Legion transfer request transaction did not emit TransferRequested.');
};

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  if (Number(manifest.chainId) !== 31337 || manifest.localOnly !== true) throw new Error('Franchise V2 E2E permits only an isolated localhost manifest.');
  const { ethers } = await network.connect(); const chain = await ethers.provider.getNetwork(); if (chain.chainId !== 31337n) throw new Error('Franchise V2 E2E requires chain 31337.');
  const [defaultAdmin, roleOne, roleTwo, roleThree, _pauser, applicant, buyer] = await ethers.getSigners();
  // The deployment intentionally uses the same separated local signers for
  // Legion minter / Franchise admin, Legion pauser / Franchise minter, and
  // Franchise transfer approver; no application role is inferred here.
  const legionMinter = roleOne; const franchiseAdmin = roleOne; const franchiseMinter = roleTwo; const franchiseApprover = roleThree;
  const legion = await ethers.getContractAt('LegionNFTV2', manifest.contracts.LegionNFTV2.address);
  const registry = await ethers.getContractAt('FranchiseRegistryV2', manifest.contracts.FranchiseRegistryV2.address);
  const nft = await ethers.getContractAt('FranchiseNFTV2', manifest.contracts.FranchiseNFTV2.address);
  const evidence: any[] = [];
  evidence.push(await receiptEvidence(await legion.connect(legionMinter).mintCountry(applicant.address, 'E2E Country', 'e2e-country', 1n, 'ipfs://abcdefi-e2e/country.json'), 'Country mint'));
  evidence.push(await receiptEvidence(await legion.connect(legionMinter).mintState(applicant.address, 'E2E State', 'e2e-state', 1n, 2n, 'ipfs://abcdefi-e2e/state.json'), 'State mint'));
  evidence.push(await receiptEvidence(await legion.connect(legionMinter).mintDistrict(applicant.address, 'E2E District', 'e2e-district', 2n, 3n, 'ipfs://abcdefi-e2e/district.json'), 'District mint'));
  const legionRequestTx = await legion.connect(applicant).requestTransfer(3n, buyer.address);
  const legionRequestReceipt = await legionRequestTx.wait();
  if (!legionRequestReceipt || legionRequestReceipt.status !== 1) throw new Error('Legion transfer request failed.');
  const legionRequestId = transferRequestIdFromReceipt(legion, legionRequestReceipt);
  evidence.push({ label: 'Legion transfer request', transactionHash: legionRequestTx.hash, blockNumber: legionRequestReceipt.blockNumber, gasUsed: legionRequestReceipt.gasUsed.toString(), logCount: legionRequestReceipt.logs.length, requestId: legionRequestId.toString() });
  evidence.push(await receiptEvidence(await legion.connect(defaultAdmin).approveTransfer(legionRequestId), 'Legion transfer approval'));
  evidence.push(await receiptEvidence(await legion.connect(applicant).executeTransfer(legionRequestId), 'Legion transfer execution'));
  if ((await legion.ownerOf(3n)).toLowerCase() !== buyer.address.toLowerCase()) throw new Error('Legion controlled transfer did not reach the proposed owner.');
  // Franchise ownership is intentionally independent: the original applicant remains the Franchise applicant after a Legion transfer.
  evidence.push(await receiptEvidence(await registry.connect(applicant).submitApplication(3n, 'ipfs://abcdefi-e2e/franchise.json'), 'Franchise application'));
  evidence.push(await receiptEvidence(await registry.connect(franchiseAdmin).approveApplication(1n), 'Franchise application approval'));
  evidence.push(await receiptEvidence(await registry.connect(franchiseMinter).mintApprovedApplication(1n), 'Franchise mint'));
  if ((await nft.ownerOf(1n)).toLowerCase() !== applicant.address.toLowerCase()) throw new Error('Franchise ownership was not independently assigned to the applicant.');
  evidence.push(await receiptEvidence(await registry.connect(applicant).requestTransfer(1n, buyer.address), 'Franchise transfer request'));
  evidence.push(await receiptEvidence(await registry.connect(franchiseApprover).approveTransfer(1n), 'Franchise transfer approval'));
  evidence.push(await receiptEvidence(await registry.connect(applicant).executeTransfer(1n), 'Franchise transfer execution'));
  const record = await registry.getFranchise(1n); const owner = await nft.ownerOf(1n);
  if (owner.toLowerCase() !== buyer.address.toLowerCase() || record.operator.toLowerCase() !== buyer.address.toLowerCase() || Number(record.status) !== 0) throw new Error('Franchise transfer did not preserve the owner/operator ACTIVE invariant.');
  const report = { chainId: String(chain.chainId), deploymentVersion: manifest.deploymentVersion, legionAddress: await legion.getAddress(), franchiseNFTAddress: await nft.getAddress(), franchiseRegistryAddress: await registry.getAddress(), territoryTokenIds: { country: '1', state: '2', district: '3' }, franchiseTokenId: '1', finalOwner: owner, finalOperator: record.operator, status: 'ACTIVE', transactions: evidence };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8'); console.log(JSON.stringify(report, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
