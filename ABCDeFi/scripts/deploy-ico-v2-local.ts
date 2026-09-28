import { network } from "hardhat";
import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";

const MANIFEST = path.resolve(process.env.ICO_V2_MANIFEST_PATH || "deployments.json");
const DAY = 24 * 60 * 60;

async function main() {
  const { ethers: hh } = await network.connect();
  if ((await hh.provider.getNetwork()).chainId !== 31337n) throw new Error("ICO V2 local deployment requires Hardhat 31337.");
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (manifest.icoV2) throw new Error("Refusing to overwrite an existing canonical icoV2 manifest namespace.");
  const tokenAddress = manifest.contracts?.ABCDToken?.address;
  if (!ethers.isAddress(tokenAddress) || await hh.provider.getCode(tokenAddress) === "0x") throw new Error("Canonical ABCDToken is unavailable on this local chain.");
  const [admin, , , , , community, , , , custody] = await hh.getSigners();
  const token = await hh.getContractAt("ABCDToken", tokenAddress);
  if ((await token.communityWallet()).toLowerCase() !== community.address.toLowerCase()) throw new Error("The deterministic local Community signer does not match ABCDToken.communityWallet.");
  if (await token.balanceOf(community.address) < ethers.parseUnits("50000000", 18)) throw new Error("Community allocation does not hold the approved 50M ICO inventory.");
  const feed = await (await hh.getContractFactory("MockAggregatorV3V2")).deploy(8, 600n * 10n ** 8n); await feed.waitForDeployment();
  const now = Number((await hh.provider.getBlock("latest"))!.timestamp); const start = now + 60; const end1 = start + 14 * DAY; const end2 = end1 + 14 * DAY;
  const sale = await (await hh.getContractFactory("ICOManagerV2")).deploy(tokenAddress, community.address, custody.address, await feed.getAddress(), DAY, start, end1, end1, end2, admin.address); await sale.waitForDeployment();
  const fund = await token.connect(community).transfer(await sale.getAddress(), ethers.parseUnits("50000000", 18)); const fundReceipt = await fund.wait();
  const deployTx = sale.deploymentTransaction(); const receipt = await deployTx?.wait();
  if (!receipt || receipt.status !== 1 || !fundReceipt || fundReceipt.status !== 1) throw new Error("ICO V2 deployment or Community inventory funding failed.");
  const deploymentBlock = receipt.blockNumber; const block = await hh.provider.getBlock(deploymentBlock); if (!block) throw new Error("ICO deployment block missing.");
  manifest.icoV2 = { chainId: Number(manifest.chainId), deploymentBlock, deploymentVersion: `ico-v2-local-${block.hash}`, localOnly: true, contract: { address: await sale.getAddress(), deploymentTransactionHash: deployTx!.hash, deploymentBlock }, oracle: { mode: "local-mock-test-only", address: await feed.getAddress(), heartbeatSeconds: DAY }, communityWallet: community.address, proceedsRecipient: custody.address, inventory: "50000000000000000000000000", stages: [{ inventory: "25000000000000000000000000", priceUsdWad: "8000000000000000", start, end: end1 }, { inventory: "25000000000000000000000000", priceUsdWad: "10000000000000000", start: end1, end: end2 }] };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ manifest: MANIFEST, ico: manifest.icoV2, fundingTransactionHash: fund.hash }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
