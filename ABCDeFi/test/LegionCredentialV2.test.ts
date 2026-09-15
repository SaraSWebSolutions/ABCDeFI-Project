import { expect } from "chai";
import { ethers } from "ethers";
import { network } from "hardhat";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("LegionCredentialV2", function () {
  let credential: any;
  let admin: any;
  let minter: any;
  let pauser: any;
  let holder: any;
  let secondHolder: any;
  let outsider: any;

  const category = "Recognized Participant";
  const metadataURI = "ipfs://bafybeilegioncredential/metadata.json";

  beforeEach(async function () {
    [admin, minter, pauser, holder, secondHolder, outsider] = await hardhatEthers.getSigners();
    const Factory = await hardhatEthers.getContractFactory("LegionCredentialV2");
    credential = await Factory.deploy(admin.address, minter.address);
    await credential.waitForDeployment();
    await credential.connect(admin).grantRole(await credential.PAUSER_ROLE(), pauser.address);
  });

  async function mint(recipient = holder.address, uri = metadataURI) {
    return credential.connect(minter).mintCredential(recipient, category, uri);
  }

  it("deploys with the approved identity, roles, and empty active registry", async function () {
    expect(await credential.name()).to.equal("ABCDeFi Legion Credential V2");
    expect(await credential.symbol()).to.equal("ABCD-LEGION-V2");
    expect(await credential.hasRole(await credential.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
    expect(await credential.hasRole(await credential.LEGION_ADMIN_ROLE(), admin.address)).to.equal(true);
    expect(await credential.hasRole(await credential.LEGION_MINTER_ROLE(), minter.address)).to.equal(true);
    expect(await credential.activeCredentialOf(holder.address)).to.equal(0n);
  });

  it("restricts lifecycle administration, minting, and pause authority", async function () {
    await expect(credential.connect(outsider).mintCredential(holder.address, category, metadataURI)).to.revert(ethers);
    await mint();
    await expect(credential.connect(outsider).updateCategory(1, "Other")).to.revert(ethers);
    await expect(credential.connect(outsider).pause()).to.revert(ethers);
    await credential.connect(pauser).pause();
    expect(await credential.paused()).to.equal(true);
  });

  it("mints one active credential with canonical metadata and lifecycle event", async function () {
    await expect(mint())
      .to.emit(credential, "LegionCredentialMinted")
      .withArgs(1, holder.address, category, metadataURI);
    const state = await credential.getCredential(1);
    expect(state.status).to.equal(0n);
    expect(state.category).to.equal(category);
    expect(await credential.ownerOf(1)).to.equal(holder.address);
    expect(await credential.tokenURI(1)).to.equal(metadataURI);
    expect(await credential.activeCredentialOf(holder.address)).to.equal(1n);
    expect(await credential.hasActiveCredential(holder.address)).to.equal(true);
  });

  it("rejects an invalid recipient, duplicate active credential, invalid category, and non-IPFS metadata", async function () {
    await expect(credential.connect(minter).mintCredential(ethers.ZeroAddress, category, metadataURI)).to.be.revertedWithCustomError(credential, "InvalidAddress");
    await expect(credential.connect(minter).mintCredential(holder.address, "", metadataURI)).to.be.revertedWithCustomError(credential, "InvalidCategory");
    await expect(credential.connect(minter).mintCredential(holder.address, category, "https://example.test/metadata.json")).to.be.revertedWithCustomError(credential, "InvalidMetadataURI");
    await mint();
    await expect(mint()).to.be.revertedWithCustomError(credential, "CredentialAlreadyActive");
  });

  it("blocks every normal transfer and approval path", async function () {
    await mint();
    await expect(credential.connect(holder).transferFrom(holder.address, secondHolder.address, 1)).to.be.revertedWithCustomError(credential, "CredentialNonTransferable");
    await expect(credential.connect(holder)["safeTransferFrom(address,address,uint256)"](holder.address, secondHolder.address, 1)).to.be.revertedWithCustomError(credential, "CredentialNonTransferable");
    await expect(credential.connect(holder)["safeTransferFrom(address,address,uint256,bytes)"](holder.address, secondHolder.address, 1, "0x1234")).to.be.revertedWithCustomError(credential, "CredentialNonTransferable");
    await expect(credential.connect(holder).approve(secondHolder.address, 1)).to.be.revertedWithCustomError(credential, "CredentialNonTransferable");
    await expect(credential.connect(holder).setApprovalForAll(secondHolder.address, true)).to.be.revertedWithCustomError(credential, "CredentialNonTransferable");
    expect(await credential.ownerOf(1)).to.equal(holder.address);
  });

  it("allows only an administrator to update approved category and metadata", async function () {
    await mint();
    await expect(credential.connect(admin).updateCategory(1, "Approved Contributor"))
      .to.emit(credential, "LegionCredentialCategoryUpdated")
      .withArgs(1, category, "Approved Contributor");
    await expect(credential.connect(admin).updateMetadata(1, "ipfs://bafybeilegioncredential/revised.json"))
      .to.emit(credential, "LegionCredentialMetadataUpdated")
      .withArgs(1, metadataURI, "ipfs://bafybeilegioncredential/revised.json");
    expect((await credential.getCredential(1)).category).to.equal("Approved Contributor");
    expect(await credential.tokenURI(1)).to.equal("ipfs://bafybeilegioncredential/revised.json");
    await expect(credential.connect(outsider).updateMetadata(1, metadataURI)).to.revert(ethers);
  });

  it("suspends and reactivates an active credential without financial consequences", async function () {
    await mint();
    await expect(credential.connect(admin).suspend(1))
      .to.emit(credential, "LegionCredentialSuspended")
      .withArgs(1, holder.address);
    expect((await credential.getCredential(1)).status).to.equal(1n);
    expect(await credential.activeCredentialOf(holder.address)).to.equal(0n);
    await expect(credential.connect(admin).suspend(1)).to.be.revertedWithCustomError(credential, "CredentialAlreadySuspended");
    await expect(credential.connect(admin).reactivate(1))
      .to.emit(credential, "LegionCredentialReactivated")
      .withArgs(1, holder.address);
    expect((await credential.getCredential(1)).status).to.equal(0n);
    expect(await credential.activeCredentialOf(holder.address)).to.equal(1n);
    await expect(credential.connect(admin).reactivate(1)).to.be.revertedWithCustomError(credential, "CredentialNotSuspended");
  });

  it("preserves provenance on revocation and removes only active status", async function () {
    await mint();
    await expect(credential.connect(admin).revoke(1))
      .to.emit(credential, "LegionCredentialRevoked")
      .withArgs(1, holder.address);
    expect((await credential.getCredential(1)).status).to.equal(2n);
    expect(await credential.ownerOf(1)).to.equal(holder.address);
    expect(await credential.tokenURI(1)).to.equal(metadataURI);
    expect(await credential.activeCredentialOf(holder.address)).to.equal(0n);
    await expect(credential.connect(admin).revoke(1)).to.be.revertedWithCustomError(credential, "CredentialAlreadyRevoked");
    await expect(credential.connect(admin).reactivate(1)).to.be.revertedWithCustomError(credential, "CredentialAlreadyRevoked");
    await expect(credential.connect(admin).migrateWallet(1, secondHolder.address)).to.be.revertedWithCustomError(credential, "CredentialAlreadyRevoked");
  });

  it("performs only authorized, provenance-preserving migration and prevents duplicate active credentials", async function () {
    await mint();
    await expect(credential.connect(outsider).migrateWallet(1, secondHolder.address)).to.revert(ethers);
    await expect(credential.connect(admin).migrateWallet(1, ethers.ZeroAddress)).to.be.revertedWithCustomError(credential, "InvalidAddress");
    await expect(credential.connect(admin).migrateWallet(1, holder.address)).to.be.revertedWithCustomError(credential, "InvalidMigration");
    await expect(credential.connect(admin).migrateWallet(1, secondHolder.address))
      .to.emit(credential, "LegionCredentialMigrated")
      .withArgs(1, holder.address, secondHolder.address);
    expect(await credential.ownerOf(1)).to.equal(secondHolder.address);
    expect(await credential.activeCredentialOf(holder.address)).to.equal(0n);
    expect(await credential.activeCredentialOf(secondHolder.address)).to.equal(1n);

    await mint(outsider.address);
    await expect(credential.connect(admin).migrateWallet(1, outsider.address)).to.be.revertedWithCustomError(credential, "CredentialAlreadyActive");
    expect(await credential.ownerOf(1)).to.equal(secondHolder.address);
  });

  it("keeps an active registry consistent across a suspended migration and a later reactivation", async function () {
    await mint();
    await credential.connect(admin).suspend(1);
    await credential.connect(admin).migrateWallet(1, secondHolder.address);
    expect(await credential.activeCredentialOf(holder.address)).to.equal(0n);
    expect(await credential.activeCredentialOf(secondHolder.address)).to.equal(0n);
    await credential.connect(admin).reactivate(1);
    expect(await credential.activeCredentialOf(secondHolder.address)).to.equal(1n);
  });

  it("pauses protected state changes while retaining read access and allows recovery after unpause", async function () {
    await credential.connect(pauser).pause();
    expect(await credential.paused()).to.equal(true);
    await expect(mint()).to.be.revertedWithCustomError(credential, "EnforcedPause");
    await credential.connect(pauser).unpause();
    await mint();
    await credential.connect(pauser).pause();
    await expect(credential.connect(admin).updateCategory(1, "Paused change")).to.be.revertedWithCustomError(credential, "EnforcedPause");
    expect((await credential.getCredential(1)).category).to.equal(category);
    await credential.connect(pauser).unpause();
    await credential.connect(admin).updateCategory(1, "Permitted change");
    expect((await credential.getCredential(1)).category).to.equal("Permitted change");
  });

  it("rejects nonexistent token lifecycle calls", async function () {
    await expect(credential.connect(admin).updateCategory(999, category)).to.revert(ethers);
    await expect(credential.connect(admin).suspend(999)).to.revert(ethers);
    await expect(credential.connect(admin).getCredential(999)).to.revert(ethers);
  });
});
