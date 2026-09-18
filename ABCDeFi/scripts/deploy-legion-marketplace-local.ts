import fs from 'node:fs';
import path from 'node:path';
import { network } from 'hardhat';

async function main() {
  const { ethers } = await network.connect();
  const [defaultAdmin, legionMinter, legionAdmin, settlementAdmin, pauser] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();
  if (chain.chainId !== 31337n) throw new Error('Legion marketplace local deployment requires chain 31337.');
  const Token = await ethers.getContractFactory('ABCDToken');
  const abcd = await Token.deploy(defaultAdmin.address, defaultAdmin.address, defaultAdmin.address, defaultAdmin.address, defaultAdmin.address, defaultAdmin.address, defaultAdmin.address, defaultAdmin.address);
  await abcd.waitForDeployment();
  const Legion = await ethers.getContractFactory('LegionNFTV2');
  const legion = await Legion.deploy(legionAdmin.address, legionMinter.address, pauser.address);
  await legion.waitForDeployment();
  const Adapter = await ethers.getContractFactory('LegionMarketplaceSettlementAdapterV2');
  const adapter = await Adapter.deploy(await legion.getAddress(), await abcd.getAddress(), defaultAdmin.address, settlementAdmin.address, pauser.address);
  await adapter.waitForDeployment();
  const grant = await legion.connect(legionAdmin).grantRole(await legion.LEGION_MARKETPLACE_SETTLER_ROLE(), await adapter.getAddress());
  const grantReceipt = await grant.wait();
  if (!grantReceipt || Number(grantReceipt.status) !== 1) throw new Error('Granting the dedicated Legion marketplace settlement role failed.');
  const deploymentBlock = Number(grantReceipt.blockNumber);
  const deploymentBlockHash = (await ethers.provider.getBlock(deploymentBlock))?.hash;
  if (!deploymentBlockHash) throw new Error('Local Legion marketplace deployment block hash is unavailable.');
  const txBlock = async (contract: any) => Number((await contract.deploymentTransaction()!.wait())!.blockNumber);
  const manifest = { deploymentVersion: `legion-marketplace-v2-local-v1-${deploymentBlockHash}`, network: 'hardhat-local', chainId: 31337, rpcUrl: 'http://127.0.0.1:8545', deploymentBlock, contracts: { ABCDToken: { address: await abcd.getAddress(), deploymentBlock: await txBlock(abcd) }, LegionNFTV2: { address: await legion.getAddress(), deploymentBlock: await txBlock(legion) }, LegionMarketplaceSettlementAdapterV2: { address: await adapter.getAddress(), deploymentBlock, settlementRoleGrantTransaction: grant.hash } }, roles: { defaultAdmin: defaultAdmin.address, legionAdmin: legionAdmin.address, legionMinter: legionMinter.address, settlementAdmin: settlementAdmin.address, pauser: pauser.address } };
  const manifestPath = path.resolve(process.env.LEGION_MARKETPLACE_MANIFEST_PATH || 'deployments.legion-marketplace-v2-local.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ manifestPath, ...manifest }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
