import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";
import { BSC_TESTNET_CHAIN_ID, loadAbcdBscTestnetConfig, ROLE, verifyCanonicalAbcdToken } from "./abcd-bsc-testnet-config";

async function main() {
  const config = loadAbcdBscTestnetConfig();
  const manifestPath = path.resolve(config.manifestPath);
  const { ethers } = await network.connect();
  if ((await ethers.provider.getNetwork()).chainId !== BSC_TESTNET_CHAIN_ID) throw new Error("This script permits BSC Testnet (97) only.");
  const [deployer] = await ethers.getSigners();
  if (deployer.address.toLowerCase() !== config.deployer.toLowerCase()) throw new Error("BSC_TESTNET_ABCD_DEPLOYER does not match the deployment signer.");
  if (await ethers.provider.getBalance(deployer.address) === 0n) throw new Error("ABCD deployer has no BNB for BSC Testnet gas.");
  const existing = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
  if ((existing.chainId != null && String(existing.chainId) !== "97") || (existing.network != null && existing.network !== "bscTestnet") || existing.contracts?.ABCDToken) throw new Error("Refusing to overwrite a non-BSC or existing canonical ABCD manifest.");
  const factory = await ethers.getContractFactory("ABCDToken");
  const token = await factory.deploy(config.infrastructure, config.liquidity, config.marketing, config.contracts, config.community, config.education, config.contingency, config.reserve);
  await token.waitForDeployment();
  const tx = token.deploymentTransaction(); const receipt = tx && await tx.wait();
  if (!tx || !receipt || receipt.status !== 1) throw new Error("ABCDToken deployment failed.");
  const grant = async (role: string, holder: string) => { if (!await token.hasRole(ROLE(role), holder)) { const r = await (await token.grantRole(ROLE(role), holder)).wait(); if (!r || r.status !== 1) throw new Error(`${role} grant failed.`); } };
  await grant("DEFAULT_ADMIN_ROLE", config.defaultAdmin); await grant("MINTER_ROLE", config.minter); await grant("BURNER_ROLE", config.burner); await grant("PAUSER_ROLE", config.pauser);
  if ((await token.owner()).toLowerCase() !== config.owner.toLowerCase()) { const r = await (await token.transferOwnership(config.owner)).wait(); if (!r || r.status !== 1) throw new Error("ABCD ownership handoff failed."); }
  for (const [role, holder] of [["MINTER_ROLE", config.minter], ["BURNER_ROLE", config.burner], ["PAUSER_ROLE", config.pauser], ["DEFAULT_ADMIN_ROLE", config.defaultAdmin]] as const) if (deployer.address.toLowerCase() !== holder.toLowerCase()) { const r = await (await token.revokeRole(ROLE(role), deployer.address)).wait(); if (!r || r.status !== 1) throw new Error(`${role} deployer revocation failed.`); }
  const result = await verifyCanonicalAbcdToken(config, ethers.provider, await token.getAddress(), receipt.blockNumber);
  const manifest = { ...existing, schemaVersion: "1.0", network: "bscTestnet", chainId: "97", rpcUrl: config.rpcUrl, deploymentBlock: receipt.blockNumber, deployer: deployer.address, contracts: { ...(existing.contracts || {}), ABCDToken: { address: await token.getAddress(), deploymentTransactionHash: tx.hash, deploymentBlock: receipt.blockNumber } }, canonicalAbcd: result };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true }); fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ status: "PASS", chainId: 97, deployment: { address: await token.getAddress(), transactionHash: tx.hash, block: receipt.blockNumber }, verification: result }, null, 2));
}
main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
