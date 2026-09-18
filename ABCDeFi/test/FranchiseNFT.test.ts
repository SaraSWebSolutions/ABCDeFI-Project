import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

describe("Phase 9 Franchise foundation", function () {
  let hh: any;
  let nft: any;
  let registry: any;
  let defaultAdmin: any;
  let registryAdmin: any;
  let issuer: any;
  let lifecycleAdmin: any;
  let pauser: any;
  let unpauser: any;
  let holder: any;
  let proposed: any;
  let outsider: any;

  const territoryKey = (value = "continental:in") => ethers.keccak256(ethers.toUtf8Bytes(value));
  const metadataURI = "ipfs://bafybeigdyrzt4examplefranchisemetadata/metadata.json";

  beforeEach(async function () {
    hh = (await network.connect()).ethers;
    [defaultAdmin, registryAdmin, issuer, lifecycleAdmin, pauser, unpauser, holder, proposed, outsider] = await hh.getSigners();

    const NFT = await hh.getContractFactory("FranchiseNFT");
    nft = await NFT.deploy(defaultAdmin.address);
    await nft.waitForDeployment();

    const Registry = await hh.getContractFactory("FranchiseRegistry");
    registry = await Registry.deploy(
      await nft.getAddress(),
      defaultAdmin.address,
      registryAdmin.address,
      issuer.address,
      lifecycleAdmin.address,
      pauser.address,
      unpauser.address,
    );
    await registry.waitForDeployment();
    await nft.connect(defaultAdmin).setRegistry(await registry.getAddress());

    await registry.connect(registryAdmin).setOperatorEligibility(holder.address, true);
    await registry.connect(registryAdmin).setOperatorEligibility(proposed.address, true);
  });

  async function register(key = territoryKey(), level = 0, parentTokenId = 0, operator = holder.address) {
    return registry.connect(issuer).registerFranchise(key, level, parentTokenId, operator, metadataURI);
  }

  async function registered() {
    await register();
    return 1n;
  }

  async function approvedRequest() {
    const tokenId = await registered();
    await registry.connect(holder).requestTransfer(tokenId, proposed.address);
    await registry.connect(registryAdmin).approveTransfer(1);
    return { tokenId, requestId: 1n };
  }

  it("restricts deterministic territory registration and atomically establishes owner/operator equality", async function () {
    await expect(register()).to.emit(registry, "FranchiseRegistered");
    const franchise = await registry.getFranchise(1);
    expect(franchise.territoryKey).to.equal(territoryKey());
    expect(franchise.level).to.equal(0n);
    expect(franchise.parentTokenId).to.equal(0n);
    expect(franchise.operator).to.equal(holder.address);
    expect(franchise.status).to.equal(0n);
    expect(franchise.operatorVersion).to.equal(1n);
    expect(await nft.ownerOf(1)).to.equal(holder.address);
    expect(await nft.tokenURI(1)).to.equal(metadataURI);
    expect(await registry.tokenIdForTerritory(territoryKey())).to.equal(1n);

    await expect(register()).to.be.revertedWithCustomError(registry, "TerritoryAlreadyRegistered");
    await expect(registry.connect(outsider).registerFranchise(territoryKey("other"), 0, 0, holder.address, metadataURI))
      .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await expect(registry.connect(issuer).registerFranchise(territoryKey("unapproved"), 0, 0, outsider.address, metadataURI))
      .to.be.revertedWithCustomError(registry, "OperatorNotEligible");
  });

  it("enforces the immutable Continental -> National -> State -> District hierarchy", async function () {
    await register(territoryKey("continental:in"), 0, 0);
    await register(territoryKey("national:in"), 1, 1);
    await register(territoryKey("state:in-tg"), 2, 2);
    await register(territoryKey("district:in-tg-hyd"), 3, 3);

    expect((await registry.getFranchise(1)).parentTokenId).to.equal(0n);
    expect((await registry.getFranchise(2)).parentTokenId).to.equal(1n);
    expect((await registry.getFranchise(3)).parentTokenId).to.equal(2n);
    expect((await registry.getFranchise(4)).parentTokenId).to.equal(3n);

    await expect(register(territoryKey("continental:invalid-parent"), 0, 1))
      .to.be.revertedWithCustomError(registry, "InvalidParent");
    await expect(register(territoryKey("national:missing-parent"), 1, 0))
      .to.be.revertedWithCustomError(registry, "InvalidParent");
    await expect(register(territoryKey("state:wrong-parent"), 2, 1))
      .to.be.revertedWithCustomError(registry, "InvalidParentLevel");
  });

  it("allows only the bound Registry to mint and rejects malformed metadata", async function () {
    await expect(nft.connect(outsider).mintFromRegistry(holder.address, 1, metadataURI))
      .to.be.revertedWithCustomError(nft, "OnlyRegistry");
    await expect(registry.connect(issuer).registerFranchise(territoryKey(), 0, 0, holder.address, "https://example.invalid/metadata.json"))
      .to.be.revertedWithCustomError(nft, "InvalidMetadataURI");
    await expect(nft.connect(outsider).setRegistry(outsider.address))
      .to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");

    const NFT = await hh.getContractFactory("FranchiseNFT");
    const unboundNFT = await NFT.deploy(defaultAdmin.address);
    await unboundNFT.waitForDeployment();
    await expect(unboundNFT.connect(defaultAdmin).setRegistry(outsider.address))
      .to.be.revertedWithCustomError(unboundNFT, "InvalidAddress");
  });

  it("rejects every direct ERC-721 transfer and approval path", async function () {
    const tokenId = await registered();
    await expect(nft.connect(holder).transferFrom(holder.address, proposed.address, tokenId))
      .to.be.revertedWithCustomError(nft, "DirectTransferForbidden");
    await expect(nft.connect(holder)["safeTransferFrom(address,address,uint256)"](holder.address, proposed.address, tokenId))
      .to.be.revertedWithCustomError(nft, "DirectTransferForbidden");
    await expect(nft.connect(holder).approve(outsider.address, tokenId))
      .to.be.revertedWithCustomError(nft, "DirectApprovalForbidden");
    await expect(nft.connect(holder).setApprovalForAll(outsider.address, true))
      .to.be.revertedWithCustomError(nft, "DirectApprovalForbidden");
  });

  it("executes an approved Registry transfer atomically and consumes its request", async function () {
    const { tokenId, requestId } = await approvedRequest();
    await expect(registry.connect(outsider).executeTransfer(requestId))
      .to.be.revertedWithCustomError(registry, "NotCurrentOperator");
    await expect(registry.connect(holder).executeTransfer(requestId))
      .to.emit(registry, "FranchiseTransferred");

    const franchise = await registry.getFranchise(tokenId);
    const request = await registry.getTransferRequest(requestId);
    expect(await nft.ownerOf(tokenId)).to.equal(proposed.address);
    expect(franchise.operator).to.equal(proposed.address);
    expect(franchise.operatorVersion).to.equal(2n);
    expect(request.active).to.equal(false);
    expect(await registry.activeTransferRequestForToken(tokenId)).to.equal(0n);
    await expect(registry.connect(holder).executeTransfer(requestId))
      .to.be.revertedWithCustomError(registry, "TransferRequestNotFound");
  });

  it("requires administrative eligibility approval and supports authorized request cancellation/invalidation", async function () {
    const tokenId = await registered();
    await registry.connect(holder).requestTransfer(tokenId, proposed.address);
    await expect(registry.connect(outsider).approveTransfer(1)).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await registry.connect(holder).cancelTransferRequest(1);
    await expect(registry.connect(registryAdmin).approveTransfer(1))
      .to.be.revertedWithCustomError(registry, "TransferRequestNotFound");

    await registry.connect(holder).requestTransfer(tokenId, proposed.address);
    await registry.connect(registryAdmin).invalidateTransferRequest(2);
    await expect(registry.connect(holder).executeTransfer(2))
      .to.be.revertedWithCustomError(registry, "TransferRequestNotFound");

    await registry.connect(holder).requestTransfer(tokenId, proposed.address);
    await registry.connect(registryAdmin).setOperatorEligibility(proposed.address, false);
    await expect(registry.connect(registryAdmin).approveTransfer(3))
      .to.be.revertedWithCustomError(registry, "OperatorNotEligible");
  });

  it("emits complete Registry provenance for eligibility, transfer request/approval/cancellation, and pause", async function () {
    const tokenId = await registered();
    await expect(registry.connect(registryAdmin).setOperatorEligibility(outsider.address, true))
      .to.emit(registry, "OperatorEligibilitySet").withArgs(outsider.address, true, registryAdmin.address);
    await expect(registry.connect(holder).requestTransfer(tokenId, proposed.address))
      .to.emit(registry, "TransferRequested");
    await expect(registry.connect(registryAdmin).approveTransfer(1))
      .to.emit(registry, "TransferApproved");
    await expect(registry.connect(holder).cancelTransferRequest(1))
      .to.emit(registry, "TransferCancelled");
    await expect(registry.connect(pauser).pause()).to.emit(registry, "Paused").withArgs(pauser.address);
    await expect(registry.connect(unpauser).unpause()).to.emit(registry, "Unpaused").withArgs(unpauser.address);
  });

  it("fails closed when a test-only NFT fixture exposes an owner/operator mismatch or stale request", async function () {
    const MockNFT = await hh.getContractFactory("MockFranchiseNFTForRegistry");
    const mockNFT = await MockNFT.deploy();
    await mockNFT.waitForDeployment();
    const Registry = await hh.getContractFactory("FranchiseRegistry");
    const isolatedRegistry = await Registry.deploy(
      await mockNFT.getAddress(),
      defaultAdmin.address,
      registryAdmin.address,
      issuer.address,
      lifecycleAdmin.address,
      pauser.address,
      unpauser.address,
    );
    await isolatedRegistry.waitForDeployment();
    await isolatedRegistry.connect(registryAdmin).setOperatorEligibility(holder.address, true);
    await isolatedRegistry.connect(registryAdmin).setOperatorEligibility(proposed.address, true);
    await isolatedRegistry.connect(issuer).registerFranchise(territoryKey("mock:continental"), 0, 0, holder.address, metadataURI);
    await isolatedRegistry.connect(holder).requestTransfer(1, proposed.address);
    await isolatedRegistry.connect(registryAdmin).approveTransfer(1);

    await mockNFT.forceOwnerForTest(1, outsider.address);
    await expect(isolatedRegistry.connect(holder).executeTransfer(1))
      .to.be.revertedWithCustomError(isolatedRegistry, "TransferRequestStale");
    await expect(isolatedRegistry.connect(holder).cancelTransferRequest(1))
      .to.be.revertedWithCustomError(isolatedRegistry, "OperatorOwnerMismatch");
    await expect(isolatedRegistry.connect(lifecycleAdmin).suspend(1))
      .to.be.revertedWithCustomError(isolatedRegistry, "OperatorOwnerMismatch");
  });

  it("consumes state before a malicious ERC-721 receiver callback and blocks nested requests", async function () {
    const tokenId = await registered();
    const Receiver = await hh.getContractFactory("ReentrantFranchiseReceiver");
    const receiver = await Receiver.deploy(await registry.getAddress());
    await receiver.waitForDeployment();
    await registry.connect(registryAdmin).setOperatorEligibility(await receiver.getAddress(), true);
    await receiver.arm(tokenId, outsider.address);
    await registry.connect(holder).requestTransfer(tokenId, await receiver.getAddress());
    await registry.connect(registryAdmin).approveTransfer(1);
    await registry.connect(holder).executeTransfer(1);

    expect(await receiver.attempted()).to.equal(true);
    expect(await receiver.succeeded()).to.equal(false);
    expect(await registry.activeTransferRequestForToken(tokenId)).to.equal(0n);
    expect((await registry.getFranchise(tokenId)).operator).to.equal(await receiver.getAddress());
    expect(await nft.ownerOf(tokenId)).to.equal(await receiver.getAddress());
  });

  it("enforces exactly the approved lifecycle transitions and preserves NFT ownership", async function () {
    const tokenId = await registered();
    await expect(registry.connect(lifecycleAdmin).suspend(tokenId)).to.emit(registry, "FranchiseStatusChanged");
    expect((await registry.getFranchise(tokenId)).status).to.equal(1n);
    await expect(registry.connect(holder).requestTransfer(tokenId, proposed.address))
      .to.be.revertedWithCustomError(registry, "InvalidLifecycleTransition");
    await registry.connect(lifecycleAdmin).reactivate(tokenId);
    expect((await registry.getFranchise(tokenId)).status).to.equal(0n);
    await registry.connect(lifecycleAdmin).revoke(tokenId);
    expect((await registry.getFranchise(tokenId)).status).to.equal(2n);
    expect(await nft.ownerOf(tokenId)).to.equal(holder.address);
    await expect(registry.connect(lifecycleAdmin).reactivate(tokenId))
      .to.be.revertedWithCustomError(registry, "InvalidLifecycleTransition");

    const second = await register(territoryKey("continental:in-tg"));
    await registry.connect(lifecycleAdmin).suspend(2);
    await registry.connect(lifecycleAdmin).revoke(2);
    expect((await registry.getFranchise(2)).status).to.equal(2n);
    expect(second).to.not.equal(undefined);
  });

  it("applies the narrow B-04 pause to every required write while retaining reads and cancellation", async function () {
    const { tokenId, requestId } = await approvedRequest();
    await registry.connect(pauser).pause();

    await expect(registry.connect(issuer).registerFranchise(territoryKey("continental:in-tg-hyd"), 0, 0, holder.address, metadataURI))
      .to.be.revertedWithCustomError(registry, "EnforcedPause");
    await expect(registry.connect(holder).requestTransfer(tokenId, outsider.address))
      .to.be.revertedWithCustomError(registry, "EnforcedPause");
    await expect(registry.connect(registryAdmin).approveTransfer(requestId))
      .to.be.revertedWithCustomError(registry, "EnforcedPause");
    await expect(registry.connect(holder).executeTransfer(requestId))
      .to.be.revertedWithCustomError(registry, "EnforcedPause");
    await expect(registry.connect(lifecycleAdmin).suspend(tokenId)).to.be.revertedWithCustomError(registry, "EnforcedPause");
    await expect(registry.connect(lifecycleAdmin).reactivate(tokenId)).to.be.revertedWithCustomError(registry, "EnforcedPause");
    await expect(registry.connect(lifecycleAdmin).revoke(tokenId)).to.be.revertedWithCustomError(registry, "EnforcedPause");
    expect((await registry.getFranchise(tokenId)).operator).to.equal(holder.address);
    await registry.connect(holder).cancelTransferRequest(requestId);

    await expect(registry.connect(outsider).unpause()).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await registry.connect(unpauser).unpause();
    await expect(registry.connect(issuer).registerFranchise(territoryKey("continental:in-tg-hyd"), 0, 0, holder.address, metadataURI))
      .to.emit(registry, "FranchiseRegistered");
  });

  it("has no payable financial surface and rejects arbitrary lifecycle administration", async function () {
    const tokenId = await registered();
    await expect(registry.connect(outsider).suspend(tokenId)).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await expect(registry.connect(outsider).pause()).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    await expect(registry.connect(issuer).registerFranchise(territoryKey("value"), 0, 0, holder.address, metadataURI, { value: 1n })).to.revert(ethers);
  });
});
