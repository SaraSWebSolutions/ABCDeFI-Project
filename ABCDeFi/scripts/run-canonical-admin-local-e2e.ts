import fs from 'node:fs';
import path from 'node:path';
import { network } from 'hardhat';

type LocalManifest = { chainId: number | string; deploymentVersion: string; contracts: Record<string, { address: string }>; roles: Record<string, string> };
const readManifest = (file: string) => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as LocalManifest;

function signerForAddress(signers: any[], address: string, label: string) {
  const signer = signers.find((candidate) => candidate.address.toLowerCase() === address.toLowerCase());
  if (!signer) throw new Error(`${label}: manifest role address is not available from the local Hardhat signer set.`);
  return signer;
}

async function expectPauseCycle(label: string, contract: any, pauser: any, unpauser: any, expectedPauseEvent: string, expectedUnpauseEvent: string) {
  let unauthorized = false;
  try {
    const { ethers } = await network.connect();
    await contract.connect((await ethers.getSigners())[9]).pause.staticCall();
  } catch { unauthorized = true; }
  if (!unauthorized) throw new Error(`${label}: unauthorized pause did not revert.`);
  const pauseReceipt = await (await contract.connect(pauser).pause()).wait();
  const pauseEvents = pauseReceipt!.logs.map((log: any) => { try { return contract.interface.parseLog(log)?.name; } catch { return null; } });
  if (pauseReceipt!.status !== 1 || !pauseEvents.includes(expectedPauseEvent) || !(await contract.paused())) throw new Error(`${label}: pause receipt/state/event mismatch.`);
  const unpauseReceipt = await (await contract.connect(unpauser).unpause()).wait();
  const unpauseEvents = unpauseReceipt!.logs.map((log: any) => { try { return contract.interface.parseLog(log)?.name; } catch { return null; } });
  if (unpauseReceipt!.status !== 1 || !unpauseEvents.includes(expectedUnpauseEvent) || (await contract.paused())) throw new Error(`${label}: unpause receipt/state/event mismatch.`);
  return { pauseTransaction: pauseReceipt!.hash, pauseBlock: Number(pauseReceipt!.blockNumber), unpauseTransaction: unpauseReceipt!.hash, unpauseBlock: Number(unpauseReceipt!.blockNumber) };
}

async function main() {
  const { ethers } = await network.connect();
  if ((await ethers.provider.getNetwork()).chainId !== 31337n) throw new Error('Canonical Admin local E2E requires Hardhat 31337 only.');
  const signers = await ethers.getSigners();
  const treasuryManifest = readManifest(process.env.TREASURY_V2_MANIFEST_PATH || 'deployments.treasury-v2-local.json');
  const marketplaceManifest = readManifest(process.env.ABCD_NFT_MARKETPLACE_MANIFEST_PATH || 'deployments.abcd-nft-marketplace-v2-local.json');
  const legionMarketplaceManifest = readManifest(process.env.LEGION_MARKETPLACE_MANIFEST_PATH || 'deployments.legion-marketplace-v2-local.json');
  const legionManifest = readManifest(process.env.LEGION_NFT_V2_MANIFEST_PATH || 'deployments.legion-nft-v2-local.json');
  const franchiseManifestPath = process.env.FRANCHISE_MANIFEST_PATH || 'deployments.franchise-foundation-local.json';
  const franchiseManifest = readManifest(franchiseManifestPath);

  const treasury = await ethers.getContractAt('TreasuryV2', treasuryManifest.contracts.TreasuryV2.address);
  const marketplace = await ethers.getContractAt('ABCDNFTMarketplaceV2', marketplaceManifest.contracts.ABCDNFTMarketplaceV2.address);
  const legion = await ethers.getContractAt('LegionNFTV2', legionManifest.contracts.LegionNFTV2.address);
  const legionMarketplace = await ethers.getContractAt('LegionMarketplaceSettlementAdapterV2', legionMarketplaceManifest.contracts.LegionMarketplaceSettlementAdapterV2.address);

  const franchiseNft = await ethers.getContractAt('FranchiseNFT', franchiseManifest.contracts.FranchiseNFT.address);
  const franchiseRegistry = await ethers.getContractAt('FranchiseRegistry', franchiseManifest.contracts.FranchiseRegistry.address);
  if ((await franchiseNft.registry()).toLowerCase() !== (await franchiseRegistry.getAddress()).toLowerCase()) {
    throw new Error('FranchiseNFT is not bound to the selected canonical FranchiseRegistry.');
  }

  const result = {
    chainId: '31337',
    treasury: await expectPauseCycle(
      'Treasury', treasury,
      signerForAddress(signers, treasuryManifest.roles.pauser, 'Treasury pauser'),
      signerForAddress(signers, treasuryManifest.roles.unpauser, 'Treasury unpauser'),
      'TreasuryPaused', 'TreasuryUnpaused',
    ),
    marketplace: await expectPauseCycle(
      'Marketplace', marketplace,
      signerForAddress(signers, marketplaceManifest.roles.pauser, 'Marketplace pauser'),
      signerForAddress(signers, marketplaceManifest.roles.pauser, 'Marketplace pauser'),
      'Paused', 'Unpaused',
    ),
    legion: await expectPauseCycle(
      'Legion', legion,
      signerForAddress(signers, legionManifest.roles.pauser, 'Legion pauser'),
      signerForAddress(signers, legionManifest.roles.pauser, 'Legion pauser'),
      'Paused', 'Unpaused',
    ),
    franchise: await expectPauseCycle(
      'Franchise', franchiseRegistry,
      signerForAddress(signers, franchiseManifest.deployer, 'Franchise pauser'),
      signerForAddress(signers, franchiseManifest.deployer, 'Franchise unpauser'),
      'Paused', 'Unpaused',
    ),
    legionMarketplace: await expectPauseCycle(
      'Legion Marketplace', legionMarketplace,
      signerForAddress(signers, legionMarketplaceManifest.roles.pauser, 'Legion Marketplace pauser'),
      signerForAddress(signers, legionMarketplaceManifest.roles.pauser, 'Legion Marketplace pauser'),
      'Paused', 'Unpaused',
    ),
    franchiseManifestPath: path.resolve(franchiseManifestPath),
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
