import { network } from "hardhat";
import fs from "node:fs";
import path from "node:path";

type Manifest = { chainId: string; contracts: { FranchiseNFT: { address: string }; FranchiseRegistry: { address: string } } };
const key = (value: string) => `0x${Buffer.from(value).toString("hex").padEnd(64, "0")}`;

async function confirmed(label: string, tx: { hash: string; wait: () => Promise<{ status: number; blockNumber: number } | null> }) {
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label} did not succeed.`);
  return { label, hash: tx.hash, block: receipt.blockNumber };
}

async function main() {
  const manifestPath = path.resolve(process.env.FRANCHISE_MANIFEST_PATH || "deployments.franchise-foundation-local.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
  const { ethers } = await network.connect();
  if ((await ethers.provider.getNetwork()).chainId !== 31337n || manifest.chainId !== "31337") throw new Error("Franchise E2E is local-31337 only.");
  const [admin, operator, proposed, cancelled] = await ethers.getSigners();
  const nft = await ethers.getContractAt("FranchiseNFT", manifest.contracts.FranchiseNFT.address, admin);
  const registry = await ethers.getContractAt("FranchiseRegistry", manifest.contracts.FranchiseRegistry.address, admin);
  const events = [];
  events.push(await confirmed("set operator eligible", await registry.setOperatorEligibility(operator.address, true)));
  events.push(await confirmed("set proposed operator eligible", await registry.setOperatorEligibility(proposed.address, true)));
  const territoryKey = key("test-only-phase9-franchise");
  events.push(await confirmed("register franchise", await registry.registerFranchise(territoryKey, 0, 0n, operator.address, "ipfs://test-only-phase9-franchise-metadata")));
  const tokenId = 1n;
  if ((await nft.ownerOf(tokenId)).toLowerCase() !== operator.address.toLowerCase()) throw new Error("Mint owner mismatch.");
  const operatorRegistry = registry.connect(operator);
  events.push(await confirmed("request cancelled transfer", await operatorRegistry.requestTransfer(tokenId, cancelled.address)));
  events.push(await confirmed("cancel transfer", await operatorRegistry.cancelTransferRequest(1n)));
  events.push(await confirmed("request transfer", await operatorRegistry.requestTransfer(tokenId, proposed.address)));
  events.push(await confirmed("approve transfer", await registry.approveTransfer(2n)));
  events.push(await confirmed("execute transfer", await operatorRegistry.executeTransfer(2n)));
  if ((await nft.ownerOf(tokenId)).toLowerCase() !== proposed.address.toLowerCase()) throw new Error("Controlled transfer did not update ERC-721 ownership.");
  const record = await registry.getFranchise(tokenId);
  if (record.operator.toLowerCase() !== proposed.address.toLowerCase() || record.status !== 0n) throw new Error("Registry state mismatch after transfer.");
  events.push(await confirmed("pause", await registry.pause()));
  events.push(await confirmed("unpause", await registry.unpause()));
  events.push(await confirmed("suspend", await registry.suspend(tokenId)));
  events.push(await confirmed("reactivate", await registry.reactivate(tokenId)));
  events.push(await confirmed("revoke", await registry.revoke(tokenId)));
  let directTransferRejected = false;
  try { await nft.connect(proposed).transferFrom(proposed.address, operator.address, tokenId); } catch { directTransferRejected = true; }
  if (!directTransferRejected) throw new Error("Direct ERC-721 transfer unexpectedly succeeded.");
  console.log(JSON.stringify({ chainId: "31337", nft: await nft.getAddress(), registry: await registry.getAddress(), tokenId: tokenId.toString(), finalOwner: await nft.ownerOf(tokenId), finalStatus: (await registry.getFranchise(tokenId)).status.toString(), directTransferRejected, events }, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
