import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { network } from "hardhat";

type Manifest = {
  chainId: number;
  network: string;
  localOnly: boolean;
  contracts: { LegionNFTV2: { address: string; deploymentTransactionHash: string; deploymentBlock: number } };
  roles: { defaultAdmin: string; legionAdmin: string; legionMinter: string; pauser: string };
};

const TEST_URI = "ipfs://test-only/phase8-legion-nft-v2.json";

function manifestPath() {
  return path.resolve(process.env.LEGION_NFT_V2_MANIFEST_PATH || "deployments.legion-nft-v2-local.json");
}

async function confirmed(transaction: Promise<any>, label: string) {
  const tx = await transaction;
  const receipt = await tx.wait();
  assert.equal(receipt?.status, 1, `${label} must have receipt.status === 1`);
  return { hash: tx.hash, block: receipt.blockNumber, receipt };
}

async function mustReject(action: () => Promise<unknown>, label: string) {
  await assert.rejects(action, undefined, `${label} must reject.`);
}

function eventArgs(receipt: any, contract: any, name: string) {
  const parsed = receipt.logs.map((log: any) => {
    try { return contract.interface.parseLog(log); } catch { return null; }
  }).find((event: any) => event?.name === name);
  assert.ok(parsed, `Missing ${name} event.`);
  return parsed.args;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath(), "utf8")) as Manifest;
  assert.equal(manifest.chainId, 31337);
  assert.equal(manifest.network, "localhost");
  assert.equal(manifest.localOnly, true);

  const { ethers } = await network.connect();
  assert.equal((await ethers.provider.getNetwork()).chainId, 31337n);
  const [admin, minter, pauser, countryOwner, stateOwner, districtOwner, proposedOwner, outsider] = await ethers.getSigners();
  const legion = await ethers.getContractAt("LegionNFTV2", manifest.contracts.LegionNFTV2.address);
  assert.notEqual(await ethers.provider.getCode(await legion.getAddress()), "0x");

  assert.equal(await legion.hasRole(await legion.DEFAULT_ADMIN_ROLE(), admin.address), true);
  assert.equal(await legion.hasRole(await legion.LEGION_ADMIN_ROLE(), admin.address), true);
  assert.equal(await legion.hasRole(await legion.LEGION_MINTER_ROLE(), minter.address), true);
  assert.equal(await legion.hasRole(await legion.PAUSER_ROLE(), pauser.address), true);

  const country = await confirmed(
    legion.connect(minter).mintCountry(countryOwner.address, "TEST-ONLY Country", "test-only-country", 101n, TEST_URI),
    "Country mint",
  );
  const countryId = eventArgs(country.receipt, legion, "TerritoryMinted").tokenId as bigint;
  const state = await confirmed(
    legion.connect(minter).mintState(stateOwner.address, "TEST-ONLY State", "test-only-state", countryId, 202n, TEST_URI),
    "State mint",
  );
  const stateId = eventArgs(state.receipt, legion, "TerritoryMinted").tokenId as bigint;
  const district = await confirmed(
    legion.connect(minter).mintDistrict(districtOwner.address, "TEST-ONLY District", "test-only-district", stateId, 303n, TEST_URI),
    "District mint",
  );
  const districtId = eventArgs(district.receipt, legion, "TerritoryMinted").tokenId as bigint;

  const [countryRecord, stateRecord, districtRecord] = await Promise.all([
    legion.getTerritory(countryId), legion.getTerritory(stateId), legion.getTerritory(districtId),
  ]);
  assert.equal(await legion.ownerOf(countryId), countryOwner.address);
  assert.equal(await legion.ownerOf(stateId), stateOwner.address);
  assert.equal(await legion.ownerOf(districtId), districtOwner.address);
  assert.equal(countryRecord.level, 0n);
  assert.equal(stateRecord.level, 1n);
  assert.equal(districtRecord.level, 2n);
  assert.equal(stateRecord.parentId, countryId);
  assert.equal(districtRecord.parentId, stateId);
  assert.equal(countryRecord.population, 101n);
  assert.equal(await legion.tokenURI(countryId), TEST_URI);

  const request = await confirmed(legion.connect(countryOwner).requestTransfer(countryId, proposedOwner.address), "controlled transfer request");
  const requestId = eventArgs(request.receipt, legion, "TransferRequested").requestId as bigint;
  const approval = await confirmed(legion.connect(admin).approveTransfer(requestId), "controlled transfer approval");
  const execution = await confirmed(legion.connect(countryOwner).executeTransfer(requestId), "controlled transfer execution");
  const transfer = eventArgs(execution.receipt, legion, "Transfer");
  const provenance = eventArgs(execution.receipt, legion, "TransferExecuted");
  assert.equal(transfer.from, countryOwner.address);
  assert.equal(transfer.to, proposedOwner.address);
  assert.equal(transfer.tokenId, countryId);
  assert.equal(provenance.requestId, requestId);
  assert.equal(provenance.tokenId, countryId);
  assert.equal(await legion.ownerOf(countryId), proposedOwner.address);
  assert.equal((await legion.getTerritory(countryId)).parentId, 0n);
  assert.equal(await legion.ownerOf(stateId), stateOwner.address);
  assert.equal(await legion.ownerOf(districtId), districtOwner.address);
  assert.equal((await legion.getTransferRequest(requestId)).active, false);

  await mustReject(() => legion.connect(outsider).mintCountry(outsider.address, "Unauthorized", "unauthorized", 0n, TEST_URI), "unauthorized mint");
  await mustReject(() => legion.connect(minter).mintState(stateOwner.address, "Bad parent", "bad-parent", 999n, 1n, TEST_URI), "invalid parent");
  await mustReject(() => legion.connect(minter).mintDistrict(districtOwner.address, "Wrong parent", "wrong-parent", countryId, 1n, TEST_URI), "wrong parent level");
  await mustReject(() => legion.connect(minter).mintCountry(proposedOwner.address, "Duplicate", " TEST-ONLY-COUNTRY ", 1n, TEST_URI), "duplicate territory");
  const oversized = Array.from({ length: 101 }, (_, i) => ({ recipient: outsider.address, displayName: "Test", canonicalIdentifier: `batch-${i}`, parentId: 0n, population: 0n, metadataURI: TEST_URI }));
  await mustReject(() => legion.connect(minter).batchMintCountry(oversized), "batch greater than 100");
  await mustReject(() => legion.connect(proposedOwner).transferFrom(proposedOwner.address, outsider.address, countryId), "direct transfer bypass");
  await mustReject(() => legion.connect(proposedOwner).approve(outsider.address, countryId), "approve bypass");
  await mustReject(() => legion.connect(proposedOwner).setApprovalForAll(outsider.address, true), "approvalForAll bypass");
  await mustReject(() => legion.connect(countryOwner).executeTransfer(requestId), "replayed transfer");
  await mustReject(() => legion.connect(outsider).updateMetadata(countryId, "Unauthorized", 1n, TEST_URI), "unauthorized metadata update");
  await mustReject(() => legion.connect(outsider).unpause(), "unauthorized unpause");

  const invalidatedRequest = await confirmed(legion.connect(proposedOwner).requestTransfer(countryId, outsider.address), "invalidated transfer request");
  const invalidatedRequestId = eventArgs(invalidatedRequest.receipt, legion, "TransferRequested").requestId as bigint;
  await confirmed(legion.connect(admin).invalidateTransfer(invalidatedRequestId), "transfer invalidation");
  await mustReject(() => legion.connect(proposedOwner).executeTransfer(invalidatedRequestId), "invalidated transfer execution");
  await mustReject(() => legion.connect(outsider).executeTransfer(invalidatedRequestId), "unauthorized transfer execution");

  const pausedRequest = await confirmed(legion.connect(proposedOwner).requestTransfer(countryId, outsider.address), "paused transfer request");
  const pausedRequestId = eventArgs(pausedRequest.receipt, legion, "TransferRequested").requestId as bigint;
  await confirmed(legion.connect(admin).approveTransfer(pausedRequestId), "paused transfer approval");
  const pause = await confirmed(legion.connect(pauser).pause(), "pause");
  await mustReject(() => legion.connect(proposedOwner).executeTransfer(pausedRequestId), "paused transfer execution");
  await confirmed(legion.connect(pauser).unpause(), "unpause");
  await confirmed(legion.connect(proposedOwner).cancelTransfer(pausedRequestId), "paused request cleanup");

  console.log(JSON.stringify({
    chainId: "31337",
    contractAddress: await legion.getAddress(),
    deployment: manifest.contracts.LegionNFTV2.deploymentTransactionHash,
    tokens: { country: countryId.toString(), state: stateId.toString(), district: districtId.toString() },
    ownership: { beforeCountry: countryOwner.address, afterCountry: proposedOwner.address, state: stateOwner.address, district: districtOwner.address },
    hierarchy: { stateParentId: stateRecord.parentId.toString(), districtParentId: districtRecord.parentId.toString() },
    transactions: {
      country: { hash: country.hash, block: country.block }, state: { hash: state.hash, block: state.block }, district: { hash: district.hash, block: district.block },
      request: { hash: request.hash, block: request.block, requestId: requestId.toString() }, approval: { hash: approval.hash, block: approval.block }, execution: { hash: execution.hash, block: execution.block }, pause: { hash: pause.hash, block: pause.block },
    },
    testOnlyMetadataURI: TEST_URI,
    negativeChecks: ["unauthorized mint", "invalid parent", "wrong parent level", "duplicate territory", "batch >100", "direct transfer", "approve", "setApprovalForAll", "replay", "invalidated", "unauthorized execution", "paused execution", "unauthorized metadata", "unauthorized unpause"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
