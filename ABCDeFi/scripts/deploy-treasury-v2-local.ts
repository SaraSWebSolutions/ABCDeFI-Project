import fs from 'node:fs';
import path from 'node:path';
import { network } from 'hardhat';

async function main() {
  const { ethers } = await network.connect();
  const [admin, assetManager, funderManager, operator, recipientManager, pauser, unpauser, funder, recipient] = await ethers.getSigners();
  if ((await ethers.provider.getNetwork()).chainId !== 31337n) throw new Error('TreasuryV2 requires Hardhat Local (31337).');
  const Token = await ethers.getContractFactory('ABCDToken');
  const token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
  await token.waitForDeployment();
  const Treasury = await ethers.getContractFactory('TreasuryV2');
  const treasury = await Treasury.deploy(await token.getAddress(), admin.address, assetManager.address, funderManager.address, operator.address, recipientManager.address, pauser.address, unpauser.address);
  await treasury.waitForDeployment();
  const treasuryDeploymentBlock = Number((await treasury.deploymentTransaction()!.wait())!.blockNumber);
  const deploymentHash = (await ethers.provider.getBlock(treasuryDeploymentBlock))!.hash;
  const funderConfiguration = await treasury.connect(funderManager).configureFunder(funder.address, true);
  await funderConfiguration.wait();
  const recipientConfiguration = await treasury.connect(recipientManager).configureRecipient(recipient.address, true);
  await recipientConfiguration.wait();
  const manifest = {
    deploymentVersion: `treasury-v2-local-v1-${deploymentHash}`,
    network: 'hardhat-local', chainId: 31337, rpcUrl: 'http://127.0.0.1:8545', deploymentBlock: treasuryDeploymentBlock,
    contracts: { ABCDToken: { address: await token.getAddress(), deploymentBlock: Number((await token.deploymentTransaction()!.wait())!.blockNumber) }, TreasuryV2: { address: await treasury.getAddress(), deploymentBlock: treasuryDeploymentBlock } },
    roles: { defaultAdmin: admin.address, assetManager: assetManager.address, funderManager: funderManager.address, operator: operator.address, recipientManager: recipientManager.address, pauser: pauser.address, unpauser: unpauser.address, funder: funder.address, recipient: recipient.address },
    configurationTransactions: { funder: funderConfiguration.hash, recipient: recipientConfiguration.hash }
  };
  const file = path.resolve(process.env.TREASURY_V2_MANIFEST_PATH || 'deployments.treasury-v2-local.json');
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ manifestPath: file, ...manifest }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
