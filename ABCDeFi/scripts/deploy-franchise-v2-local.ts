import { network } from 'hardhat';
import fs from 'node:fs';
import path from 'node:path';
import { keccak256 } from 'ethers';
import { sealManifest } from './deployment-manifest-guards.mjs';

const LEGION_MANIFEST_PATH = path.resolve(process.env.LEGION_NFT_V2_MANIFEST_PATH || 'deployments.legion-nft-v2-local.json');
const FRANCHISE_MANIFEST_PATH = path.resolve(process.env.FRANCHISE_V2_MANIFEST_PATH || 'deployments.franchise-v2-local.json');
const LOCAL_RPC_URL = process.env.ABCDEFI_LOCAL_RPC_URL || 'http://127.0.0.1:8545';

function loadLegionManifest() {
  if (!fs.existsSync(LEGION_MANIFEST_PATH)) throw new Error(`LegionNFTV2 manifest is missing: ${LEGION_MANIFEST_PATH}`);
  const manifest = JSON.parse(fs.readFileSync(LEGION_MANIFEST_PATH, 'utf8'));
  const legion = manifest?.contracts?.LegionNFTV2;
  if (Number(manifest?.chainId) !== 31337 || manifest?.network !== 'localhost' || manifest?.localOnly !== true || !legion?.address) throw new Error('Franchise V2 requires an isolated localhost LegionNFTV2 manifest.');
  return manifest;
}
function writeAtomically(destination: string, value: unknown) { const temporary = `${destination}.${process.pid}.tmp`; fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); fs.renameSync(temporary, destination); }

async function main() {
  const { ethers } = await network.connect();
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 31337n) throw new Error(`Franchise V2 local deployment permits only 31337; received ${chain.chainId}.`);
  if (fs.existsSync(FRANCHISE_MANIFEST_PATH) && process.env.FRANCHISE_V2_FRESH_LOCAL !== '1') throw new Error(`Refusing to overwrite ${FRANCHISE_MANIFEST_PATH}. Set FRANCHISE_V2_FRESH_LOCAL=1 only after starting a fresh local chain.`);
  const legionManifest = loadLegionManifest(); const legionAddress = legionManifest.contracts.LegionNFTV2.address;
  if (await ethers.provider.getCode(legionAddress) === '0x') throw new Error('The referenced canonical LegionNFTV2 manifest has no live bytecode.');
  const [defaultAdmin, franchiseAdmin, franchiseMinter, transferApprover, pauser] = await ethers.getSigners();
  const nft = await (await ethers.getContractFactory('FranchiseNFTV2')).deploy(defaultAdmin.address); await nft.waitForDeployment();
  const registry = await (await ethers.getContractFactory('FranchiseRegistryV2')).deploy(legionAddress, await nft.getAddress(), defaultAdmin.address, franchiseAdmin.address, franchiseMinter.address, transferApprover.address, pauser.address); await registry.waitForDeployment();
  const bind = await nft.connect(defaultAdmin).setRegistry(await registry.getAddress()); const bindReceipt = await bind.wait();
  const [nftDeployment, registryDeployment] = [nft.deploymentTransaction(), registry.deploymentTransaction()];
  const [nftReceipt, registryReceipt] = await Promise.all([nftDeployment?.wait(), registryDeployment?.wait()]);
  if (!nftDeployment || !registryDeployment || !nftReceipt || !registryReceipt || !bindReceipt || nftReceipt.status !== 1 || registryReceipt.status !== 1 || bindReceipt.status !== 1) throw new Error('Franchise V2 deployment or Registry binding failed.');
  const [nftAddress, registryAddress] = [await nft.getAddress(), await registry.getAddress()];
  if ((await ethers.provider.getCode(nftAddress)) === '0x' || (await ethers.provider.getCode(registryAddress)) === '0x' || (await nft.registry()).toLowerCase() !== registryAddress.toLowerCase()) throw new Error('Franchise V2 live bytecode or Registry binding verification failed.');
  const block = await ethers.provider.getBlock(registryReceipt.blockNumber); if (!block) throw new Error('Franchise V2 deployment block is unavailable.');
  const manifest = sealManifest({
    chainId: 31337, network: 'localhost', rpcUrl: LOCAL_RPC_URL, localOnly: true,
    deploymentVersion: `franchise-v2-local-${block.hash}`, deploymentBlock: registryReceipt.blockNumber,
    legionManifestPath: LEGION_MANIFEST_PATH,
    contracts: {
      LegionNFTV2: { address: legionAddress, deploymentBlock: legionManifest.contracts.LegionNFTV2.deploymentBlock, deploymentVersion: legionManifest.deploymentVersion, manifestHash: legionManifest.manifestHash || null, artifactIdentity: 'contracts/nft/LegionNFTV2.sol:LegionNFTV2', runtimeBytecodeHash: keccak256(await ethers.provider.getCode(legionAddress)) },
      FranchiseNFTV2: { address: nftAddress, deploymentTransactionHash: nftDeployment.hash, deploymentBlock: nftReceipt.blockNumber, constructorArgs: [defaultAdmin.address], artifactIdentity: 'contracts/nft/FranchiseNFTV2.sol:FranchiseNFTV2', runtimeBytecodeHash: keccak256(await ethers.provider.getCode(nftAddress)) },
      FranchiseRegistryV2: { address: registryAddress, deploymentTransactionHash: registryDeployment.hash, deploymentBlock: registryReceipt.blockNumber, constructorArgs: [legionAddress, nftAddress, defaultAdmin.address, franchiseAdmin.address, franchiseMinter.address, transferApprover.address, pauser.address], registryBindingTransactionHash: bind.hash, registryBindingBlock: bindReceipt.blockNumber, artifactIdentity: 'contracts/nft/FranchiseRegistryV2.sol:FranchiseRegistryV2', runtimeBytecodeHash: keccak256(await ethers.provider.getCode(registryAddress)) },
    },
    roles: { defaultAdmin: defaultAdmin.address, franchiseAdmin: franchiseAdmin.address, franchiseMinter: franchiseMinter.address, franchiseTransferApprover: transferApprover.address, pauser: pauser.address },
  });
  writeAtomically(FRANCHISE_MANIFEST_PATH, manifest); console.log(JSON.stringify(manifest, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
