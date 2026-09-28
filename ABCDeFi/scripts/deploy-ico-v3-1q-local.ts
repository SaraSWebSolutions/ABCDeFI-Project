import { network } from 'hardhat';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DAY = 24 * 60 * 60;
const INVENTORY = 50_000_000n * 10n ** 18n;
const LOCAL_RPC_URL = process.env.ABCDEFI_LOCAL_RPC_URL || 'http://127.0.0.1:8545';

type RootManifest = {
  chainId: number;
  deploymentVersion: string;
  contracts: { ABCDTokenV2: { address: string } };
  allocations: { ICO: { wallet: string; amount: string } };
};

/** LOCAL TEST ONLY. Creates an isolated ICO V3 extension manifest; it never mutates historical deployment manifests. */
async function main() {
  const rootPath = resolve(process.env.ABCD_1Q_ROOT_MANIFEST_PATH || 'deployments.abcd-1q-local.json');
  if (!existsSync(rootPath)) throw new Error(`Missing 1Q root manifest: ${rootPath}`);
  const root = JSON.parse(readFileSync(rootPath, 'utf8')) as RootManifest;
  const { ethers } = await network.connect(); const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (root.chainId !== chainId) throw new Error(`Root manifest chain mismatch: expected ${root.chainId}, live ${chainId}`);
  const tokenAddress = root.contracts?.ABCDTokenV2?.address; const icoWallet = root.allocations?.ICO?.wallet;
  if (!tokenAddress || !icoWallet) throw new Error('Root manifest lacks canonical ABCDTokenV2/ICO allocation binding.');
  const icoSigner = (await ethers.getSigners()).find((signer) => signer.address.toLowerCase() === icoWallet.toLowerCase());
  if (!icoSigner) throw new Error('Local ICO allocation wallet is not an unlocked local signer.');
  const token = await ethers.getContractAt('ABCDTokenV2', tokenAddress); if ((await token.icoWallet()).toLowerCase() !== icoWallet.toLowerCase()) throw new Error('Manifest ICO wallet does not match live ABCDTokenV2 custody binding.');
  if (await token.balanceOf(icoWallet) < INVENTORY) throw new Error('ICO allocation does not have the fixed 50M inventory.');
  const [admin,,,,,,, , custody] = await ethers.getSigners();
  const feed = await (await ethers.getContractFactory('MockAggregatorV3V2')).deploy(8, 600n * 10n ** 8n); await feed.waitForDeployment();
  const now = Number((await ethers.provider.getBlock('latest'))!.timestamp); const start = now + 60; const end1 = start + 14 * DAY; const end2 = end1 + 14 * DAY;
  const sale = await (await ethers.getContractFactory('ICOManagerV3')).deploy(tokenAddress, icoWallet, custody.address, await feed.getAddress(), DAY, start, end1, end1, end2, admin.address); await sale.waitForDeployment();
  const fundingTx = await token.connect(icoSigner).transfer(await sale.getAddress(), INVENTORY); const fundingReceipt = await fundingTx.wait(); if (!fundingReceipt) throw new Error('ICO V3 funding receipt unavailable.');
  const remaining = await token.balanceOf(icoWallet); const expectedRemaining = 200_000_000_000_000n * 10n ** 18n - INVENTORY;
  if (remaining !== expectedRemaining || await token.balanceOf(await sale.getAddress()) !== INVENTORY) throw new Error('ICO V3 custody/inventory invariant failed.');
  const output = resolve(process.env.ICO_V3_1Q_MANIFEST_PATH || 'deployments.ico-v3-1q-local.json');
  const manifest = { schemaVersion: '1.0', model: 'OWNER_APPROVED_1Q_ICO_V3', localOnly: true, rpcUrl: LOCAL_RPC_URL, chainId, rootDeploymentVersion: root.deploymentVersion, deploymentVersion: `ico-v3-1q-local-${fundingTx.hash}`, contracts: { ABCDTokenV2: { address: tokenAddress }, ICOManagerV3: { address: await sale.getAddress() }, MockAggregatorV3V2_BNB_USD: { address: await feed.getAddress() } }, custody: { icoWallet, initialAllocation: (200_000_000_000_000n * 10n ** 18n).toString(), saleInventory: INVENTORY.toString(), remainingAfterFunding: remaining.toString(), fundingTransactionHash: fundingTx.hash, fundingBlock: fundingReceipt.blockNumber }, stages: [{ inventory: (25_000_000n * 10n ** 18n).toString(), priceUsdWad: '8000000000000000' }, { inventory: (25_000_000n * 10n ** 18n).toString(), priceUsdWad: '10000000000000000' }] };
  writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n'); console.log(JSON.stringify({ output, ...manifest }, null, 2));
}
void main();
