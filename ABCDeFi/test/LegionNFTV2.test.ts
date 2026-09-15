import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

describe("LegionNFTV2", function () {
  let legion: any;
  let hh: any;
  let admin: any;
  let minter: any;
  let pauser: any;
  let holder: any;
  let buyer: any;
  let outsider: any;
  const metadata = "ipfs://bafybeilegionv2/metadata.json";

  const country = (identifier = "india", recipient?: string) => ({
    recipient: recipient ?? holder.address,
    displayName: "India",
    canonicalIdentifier: identifier,
    parentId: 0n,
    population: 1_400_000_000n,
    metadataURI: metadata,
  });

  beforeEach(async function () {
    hh = (await network.connect()).ethers;
    [admin, minter, pauser, holder, buyer, outsider] = await hh.getSigners();
    const Factory = await hh.getContractFactory("LegionNFTV2");
    legion = await Factory.deploy(admin.address, minter.address, pauser.address);
    await legion.waitForDeployment();
  });

  async function mintCountry(identifier = "india", owner = holder.address) {
    await legion.connect(minter).mintCountry(owner, "India", identifier, 1_400_000_000n, metadata);
  }

  async function mintState(identifier = "tamil-nadu", owner = holder.address) {
    await mintCountry();
    await legion.connect(minter).mintState(owner, "Tamil Nadu", identifier, 1n, 72_000_000n, metadata);
  }

  it("mints Country, State, and District with immutable approved parent links", async function () {
    await mintCountry();
    await legion.connect(minter).mintState(holder.address, "Tamil Nadu", "tamil-nadu", 1n, 72_000_000n, metadata);
    await legion.connect(minter).mintDistrict(holder.address, "Madurai", "madurai", 2n, 3_000_000n, metadata);

    const countryRecord = await legion.getTerritory(1n);
    const stateRecord = await legion.getTerritory(2n);
    const districtRecord = await legion.getTerritory(3n);
    expect(countryRecord.parentId).to.equal(0n);
    expect(stateRecord.parentId).to.equal(1n);
    expect(districtRecord.parentId).to.equal(2n);
    expect(districtRecord.population).to.equal(3_000_000n);
    expect(districtRecord.canonicalIdentifier).to.equal("madurai");
  });

  it("rejects invalid parent existence and level relationships", async function () {
    await expect(
      legion.connect(minter).mintState(holder.address, "State", "state", 999n, 1n, metadata)
    ).to.be.revertedWithCustomError(legion, "InvalidParent");

    await mintCountry();
    await expect(
      legion.connect(minter).mintDistrict(holder.address, "District", "district", 1n, 1n, metadata)
    ).to.be.revertedWithCustomError(legion, "InvalidParentLevel");
  });

  it("normalizes only surrounding ASCII spaces and ASCII uppercase before deterministic uniqueness", async function () {
    expect(await legion.normalizeIdentifier(" Madurai ")).to.equal("madurai");
    await mintCountry(" Madurai ");
    await expect(
      legion.connect(minter).mintCountry(holder.address, "Madurai", "MADURAI", 1n, metadata)
    ).to.be.revertedWithCustomError(legion, "TerritoryAlreadyRegistered");
  });

  it("rejects empty, internal whitespace, Unicode, and invalid canonical identifiers", async function () {
    for (const invalid of ["", "   ", "tamil nadu", "madurai!", "Mādurai", "a/b"]) {
      await expect(
        legion.connect(minter).mintCountry(holder.address, "Display", invalid, 1n, metadata)
      ).to.be.revertedWithCustomError(legion, "InvalidIdentifier");
    }
  });

  it("restricts minting and metadata updates to the approved roles", async function () {
    await expect(
      legion.connect(outsider).mintCountry(outsider.address, "India", "india", 1n, metadata)
    ).to.be.revertedWithCustomError(legion, "AccessControlUnauthorizedAccount");
    await mintCountry();
    await expect(
      legion.connect(outsider).updateMetadata(1n, "Other", 2n, metadata)
    ).to.be.revertedWithCustomError(legion, "AccessControlUnauthorizedAccount");
    await legion.connect(admin).updateMetadata(1n, "Republic of India", 1_400_000_001n, metadata);
    expect((await legion.getTerritory(1n)).displayName).to.equal("Republic of India");
    await expect(legion.connect(admin).updateMetadata(1n, "India", 1n, "https://not-ipfs.example/metadata.json"))
      .to.be.revertedWithCustomError(legion, "InvalidMetadataURI");
  });

  it("enforces maximum 100-item batches and atomically reverts invalid batches", async function () {
    const hundred = Array.from({ length: 100 }, (_, i) => ({
      recipient: holder.address,
      displayName: "",
      canonicalIdentifier: `country-${i}`,
      parentId: 0n,
      population: 0n,
      metadataURI: "ipfs://x",
    }));
    await legion.connect(minter).batchMintCountry(hundred, { gasLimit: 16_000_000 });
    expect(await legion.ownerOf(100n)).to.equal(holder.address);

    const oneHundredOne = Array.from({ length: 101 }, (_, i) => country(`extra-${i}`));
    await expect(legion.connect(minter).batchMintCountry(oneHundredOne))
      .to.be.revertedWithCustomError(legion, "BatchTooLarge");
    await expect(legion.connect(minter).batchMintCountry([])).to.be.revertedWithCustomError(legion, "BatchEmpty");
  });

  it("rejects duplicate items in a batch without minting any item", async function () {
    const duplicate = [country("india"), country(" INDIA ")];
    await expect(legion.connect(minter).batchMintCountry(duplicate))
      .to.be.revertedWithCustomError(legion, "TerritoryAlreadyRegistered");
    await mintCountry("india");
    expect(await legion.ownerOf(1n)).to.equal(holder.address);
  });

  it("pauses every state-changing path while reads remain available", async function () {
    await mintCountry();
    await legion.connect(holder).requestTransfer(1n, buyer.address);
    await legion.connect(pauser).pause();
    expect(await legion.paused()).to.equal(true);
    expect((await legion.getTerritory(1n)).canonicalIdentifier).to.equal("india");
    await expect(legion.connect(minter).mintCountry(holder.address, "Japan", "japan", 1n, metadata)).to.revert(ethers);
    await expect(legion.connect(holder).requestTransfer(1n, buyer.address)).to.revert(ethers);
    await expect(legion.connect(admin).updateMetadata(1n, "India", 1n, metadata)).to.revert(ethers);
    await expect(legion.connect(admin).approveTransfer(1n)).to.revert(ethers);
    await expect(legion.connect(holder).cancelTransfer(1n)).to.revert(ethers);
    await expect(legion.connect(admin).invalidateTransfer(1n)).to.revert(ethers);
    await expect(legion.connect(holder).executeTransfer(1n)).to.revert(ethers);
    await expect(legion.connect(outsider).unpause()).to.be.revertedWithCustomError(legion, "AccessControlUnauthorizedAccount");
    await legion.connect(pauser).unpause();
    await legion.connect(holder).cancelTransfer(1n);
  });

  it("rejects direct transfer and approval bypasses", async function () {
    await mintCountry();
    await expect(legion.connect(holder).transferFrom(holder.address, buyer.address, 1n))
      .to.be.revertedWithCustomError(legion, "DirectTransferForbidden");
    await expect(legion.connect(holder).approve(buyer.address, 1n))
      .to.be.revertedWithCustomError(legion, "DirectApprovalForbidden");
    await expect(legion.connect(holder).setApprovalForAll(buyer.address, true))
      .to.be.revertedWithCustomError(legion, "DirectApprovalForbidden");
  });

  it("uses a consumed, administrator-approved request for transfer", async function () {
    await mintState();
    await expect(legion.connect(holder).requestTransfer(1n, holder.address))
      .to.be.revertedWithCustomError(legion, "InvalidProposedOwner");
    await expect(legion.connect(holder).requestTransfer(1n, ethers.ZeroAddress))
      .to.be.revertedWithCustomError(legion, "InvalidProposedOwner");
    await legion.connect(holder).requestTransfer(1n, buyer.address);
    await expect(legion.connect(holder).executeTransfer(1n))
      .to.be.revertedWithCustomError(legion, "TransferRequestNotApproved");
    await expect(legion.connect(outsider).approveTransfer(1n)).to.be.revertedWithCustomError(legion, "AccessControlUnauthorizedAccount");
    await legion.connect(admin).approveTransfer(1n);
    await expect(legion.connect(outsider).executeTransfer(1n)).to.be.revertedWithCustomError(legion, "NotCurrentOwner");
    await expect(legion.connect(holder).executeTransfer(1n))
      .to.emit(legion, "Transfer")
      .withArgs(holder.address, buyer.address, 1n)
      .and.to.emit(legion, "TransferExecuted")
      .withArgs(1n, 1n, holder.address, buyer.address);
    expect(await legion.ownerOf(1n)).to.equal(buyer.address);
    expect((await legion.getTerritory(1n)).parentId).to.equal(0n);
    const consumed = await legion.getTransferRequest(1n);
    expect(consumed.active).to.equal(false);
    expect(consumed.approved).to.equal(true);
    await expect(legion.connect(holder).executeTransfer(1n)).to.be.revertedWithCustomError(legion, "TransferRequestNotFound");
  });

  it("keeps children independently owned when their parent transfers", async function () {
    await mintCountry("india", holder.address);
    await legion.connect(minter).mintState(outsider.address, "Tamil Nadu", "tamil-nadu", 1n, 72n, metadata);
    await legion.connect(holder).requestTransfer(1n, buyer.address);
    await legion.connect(admin).approveTransfer(1n);
    await legion.connect(holder).executeTransfer(1n);
    expect(await legion.ownerOf(1n)).to.equal(buyer.address);
    expect(await legion.ownerOf(2n)).to.equal(outsider.address);
    expect((await legion.getTerritory(2n)).parentId).to.equal(1n);
  });

  it("invalidates a request and rejects stale or replayed execution", async function () {
    await mintCountry();
    await legion.connect(holder).requestTransfer(1n, buyer.address);
    await legion.connect(admin).invalidateTransfer(1n);
    await expect(legion.connect(holder).executeTransfer(1n)).to.be.revertedWithCustomError(legion, "TransferRequestNotFound");
  });

  it("handles a malicious ERC721 receiver without request reuse", async function () {
    await mintCountry();
    const Receiver = await hh.getContractFactory("ReentrantLegionReceiver");
    const receiver = await Receiver.deploy(await legion.getAddress());
    await receiver.waitForDeployment();
    await legion.connect(holder).requestTransfer(1n, await receiver.getAddress());
    await receiver.setRequestId(1n);
    await legion.connect(admin).approveTransfer(1n);
    await legion.connect(holder).executeTransfer(1n);
    expect(await legion.ownerOf(1n)).to.equal(await receiver.getAddress());
    expect(await receiver.reentryAttempted()).to.equal(true);
    expect(await receiver.reentrySucceeded()).to.equal(false);
    expect(await receiver.directTransferAttempted()).to.equal(true);
    expect(await receiver.directTransferSucceeded()).to.equal(false);
  });

  it("has no payable financial path and preserves population as informational record data", async function () {
    await mintCountry("india");
    const territory = await legion.getTerritory(1n);
    expect(territory.population).to.equal(1_400_000_000n);
    await expect(holder.sendTransaction({ to: await legion.getAddress(), value: 1n })).to.revert(ethers);
  });
});
