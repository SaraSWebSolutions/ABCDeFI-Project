import fs from 'node:fs';
import path from 'node:path';
import { network } from 'hardhat';

type LocalManifest = { chainId: number; deploymentVersion: string; contracts: Record<string, { address: string }>; roles: Record<string, string> };
const readManifest = (file: string) => JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')) as LocalManifest;

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
  const treasuryManifest = readManifest('deployments.treasury-v2-local.json');
  const marketplaceManifest = readManifest('deployments.abcd-nft-marketplace-v2-local.json');
  const legionMarketplaceManifest = readManifest('deployments.legion-marketplace-v2-local.json');
  const legionManifest = readManifest('deployments.legion-nft-v2-local.json');

  const treasury = await ethers.getContractAt('TreasuryV2', treasuryManifest.contracts.TreasuryV2.address);
  const marketplace = await ethers.getContractAt('ABCDNFTMarketplaceV2', marketplaceManifest.contracts.ABCDNFTMarketplaceV2.address);
  const legion = await ethers.getContractAt('LegionNFTV2', legionManifest.contracts.LegionNFTV2.address);
  const legionMarketplace = await ethers.getContractAt('LegionMarketplaceSettlementAdapterV2', legionMarketplaceManifest.contracts.LegionMarketplaceSettlementAdapterV2.address);

  const FranchiseNFT = await ethers.getContractFactory('FranchiseNFT');
  const franchiseNft = await FranchiseNFT.deploy(signers[0].address);
  await franchiseNft.waitForDeployment();
  const FranchiseRegistry = await ethers.getContractFactory('FranchiseRegistry');
  const franchiseRegistry = await FranchiseRegistry.deploy(await franchiseNft.getAddress(), signers[0].address, signers[1].address, signers[2].address, signers[3].address, signers[4].address, signers[5].address);
  await franchiseRegistry.waitForDeployment();
  const binding = await franchiseNft.connect(signers[0]).setRegistry(await franchiseRegistry.getAddress());
  const bindingReceipt = await binding.wait();
  if (!bindingReceipt || bindingReceipt.status !== 1) throw new Error('Franchise registry binding did not succeed.');
  const franchiseBlock = Number(bindingReceipt.blockNumber);
  const franchiseBlockHash = (await ethers.provider.getBlock(franchiseBlock))!.hash;
  const franchiseManifestPath = path.resolve('deployments.phase12-admin-franchise-local.json');
  fs.writeFileSync(franchiseManifestPath, `${JSON.stringify({ network: 'localhost', chainId: '31337', rpcUrl: 'http://127.0.0.1:8545', deployer: signers[0].address, deploymentVersion: `phase12-admin-franchise-local-${franchiseBlockHash}`, contracts: { FranchiseNFT: { address: await franchiseNft.getAddress(), deploymentTransactionHash: franchiseNft.deploymentTransaction()!.hash, deploymentBlock: Number((await franchiseNft.deploymentTransaction()!.wait())!.blockNumber) }, FranchiseRegistry: { address: await franchiseRegistry.getAddress(), deploymentTransactionHash: franchiseRegistry.deploymentTransaction()!.hash, deploymentBlock: franchiseBlock } } }, null, 2)}\n`);

  const result = {
    chainId: '31337',
    treasury: await expectPauseCycle('Treasury', treasury, signers[5], signers[6], 'TreasuryPaused', 'TreasuryUnpaused'),
    marketplace: await expectPauseCycle('Marketplace', marketplace, signers[2], signers[2], 'Paused', 'Unpaused'),
    legion: await expectPauseCycle('Legion', legion, signers[2], signers[2], 'Paused', 'Unpaused'),
    franchise: await expectPauseCycle('Franchise', franchiseRegistry, signers[4], signers[5], 'Paused', 'Unpaused'),
    legionMarketplace: await expectPauseCycle('Legion Marketplace', legionMarketplace, signers[4], signers[4], 'Paused', 'Unpaused'),
    franchiseManifestPath,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
