import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";

type Manifest = {
  chainId: number;
  network: string;
  rpcUrl: string;
  deploymentVersion: string;
  deploymentBlock: number;
  localOnly: boolean;
  contracts: { LegionCredentialV2: { address: string; deploymentTransactionHash: string; deploymentBlock: number } };
  roles: { defaultAdmin: string; legionAdmin: string; legionMinter: string; pauser: string };
};

function manifestPath() {
  return path.resolve(process.env.LEGION_CREDENTIAL_MANIFEST_PATH || "deployments.legion-v2-local.json");
}

function parseEvent(receipt: any, contract: any, name: string) {
  const entry = receipt.logs.map((log: any) => {
    try { return contract.interface.parseLog(log); } catch { return null; }
  }).find((event: any) => event?.name === name);
  assert.ok(entry, `Missing ${name} event.`);
  return entry.args;
}

async function confirmed(transaction: any, label: string) {
  const tx = await transaction;
  const receipt = await tx.wait();
  assert.equal(receipt?.status, 1, `${label} must have receipt.status === 1`);
  return { hash: tx.hash, block: receipt.blockNumber, receipt };
}

async function mustReject(action: () => Promise<unknown>, label: string) {
  await assert.rejects(action, undefined, `${label} must reject.`);
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath(), "utf8")) as Manifest;
  assert.equal(manifest.chainId, 31337);
  assert.equal(manifest.network, "localhost");
  assert.equal(manifest.localOnly, true);
  const { ethers } = await network.connect();
  assert.equal((await ethers.provider.getNetwork()).chainId, 31337n);
  const [admin, minter, holder, recipient, outsider] = await ethers.getSigners();
  const credential = await ethers.getContractAt("LegionCredentialV2", manifest.contracts.LegionCredentialV2.address);
  assert.notEqual(await ethers.provider.getCode(await credential.getAddress()), "0x");
  assert.equal((await credential.DEFAULT_ADMIN_ROLE()), "0x" + "00".repeat(32));
  assert.equal(await credential.hasRole(await credential.DEFAULT_ADMIN_ROLE(), admin.address), true);
  assert.equal(await credential.hasRole(await credential.LEGION_ADMIN_ROLE(), admin.address), true);
  assert.equal(await credential.hasRole(await credential.LEGION_MINTER_ROLE(), minter.address), true);
  assert.equal(await credential.hasRole(await credential.PAUSER_ROLE(), admin.address), true);

  const initialURI = "ipfs://bafybeiphase8legioncredential/credential-1.json";
  const revisedURI = "ipfs://bafybeiphase8legioncredential/credential-1-revised.json";
  const mint = await confirmed(credential.connect(minter).mintCredential(holder.address, "Recognized Participant", initialURI), "authorized credential mint");
  const mintArgs = parseEvent(mint.receipt, credential, "LegionCredentialMinted");
  const tokenId = mintArgs.tokenId as bigint;
  assert.equal(tokenId, 1n);
  assert.equal(await credential.ownerOf(tokenId), holder.address);
  assert.equal(await credential.tokenURI(tokenId), initialURI);
  assert.equal(await credential.activeCredentialOf(holder.address), tokenId);

  await mustReject(() => credential.connect(minter).mintCredential(holder.address, "Duplicate", initialURI), "one-active-per-wallet mint");
  await mustReject(() => credential.connect(holder).transferFrom(holder.address, recipient.address, tokenId), "ordinary transfer");
  await mustReject(() => credential.connect(holder).approve(recipient.address, tokenId), "approval");
  await mustReject(() => credential.connect(outsider).suspend(tokenId), "unauthorized lifecycle operation");

  const category = await confirmed(credential.connect(admin).updateCategory(tokenId, "Approved Contributor"), "category update");
  const metadata = await confirmed(credential.connect(admin).updateMetadata(tokenId, revisedURI), "metadata update");
  const suspended = await confirmed(credential.connect(admin).suspend(tokenId), "suspension");
  assert.equal((await credential.getCredential(tokenId)).status, 1n);
  assert.equal(await credential.activeCredentialOf(holder.address), 0n);
  const reactivated = await confirmed(credential.connect(admin).reactivate(tokenId), "reactivation");
  assert.equal((await credential.getCredential(tokenId)).status, 0n);
  assert.equal(await credential.activeCredentialOf(holder.address), tokenId);
  const revoked = await confirmed(credential.connect(admin).revoke(tokenId), "revocation");
  const final = await credential.getCredential(tokenId);
  assert.equal(final.status, 2n);
  assert.equal(final.category, "Approved Contributor");
  assert.equal(await credential.tokenURI(tokenId), revisedURI);
  assert.equal(await credential.ownerOf(tokenId), holder.address);
  assert.equal(await credential.activeCredentialOf(holder.address), 0n);
  await mustReject(() => credential.connect(admin).reactivate(tokenId), "revoked credential reactivation");

  const evidence = {
    deployment: manifest.contracts.LegionCredentialV2.deploymentTransactionHash,
    tokenId: tokenId.toString(),
    holder: holder.address,
    metadataURI: revisedURI,
    mint: { hash: mint.hash, block: mint.block },
    category: { hash: category.hash, block: category.block },
    metadata: { hash: metadata.hash, block: metadata.block },
    suspension: { hash: suspended.hash, block: suspended.block },
    reactivation: { hash: reactivated.hash, block: reactivated.block },
    revocation: { hash: revoked.hash, block: revoked.block },
    finalStatus: "REVOKED",
  };
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
