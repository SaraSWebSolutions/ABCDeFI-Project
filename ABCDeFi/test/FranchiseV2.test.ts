import { expect } from 'chai';
import { network } from 'hardhat';

describe('Phase 9 Franchise V2 Legion-bound foundation', () => {
  let hh: any; let legion: any; let nft: any; let registry: any;
  let admin: any; let legionMinter: any; let franchiseAdmin: any; let franchiseMinter: any; let approver: any; let pauser: any; let applicant: any; let buyer: any; let outsider: any;
  const uri = 'ipfs://test-only/franchise-v2.json';

  beforeEach(async () => {
    hh = (await network.connect()).ethers;
    [admin, legionMinter, franchiseAdmin, franchiseMinter, approver, pauser, applicant, buyer, outsider] = await hh.getSigners();
    legion = await (await hh.getContractFactory('LegionNFTV2')).deploy(admin.address, legionMinter.address, pauser.address);
    await legion.waitForDeployment();
    nft = await (await hh.getContractFactory('FranchiseNFTV2')).deploy(admin.address);
    await nft.waitForDeployment();
    registry = await (await hh.getContractFactory('FranchiseRegistryV2')).deploy(await legion.getAddress(), await nft.getAddress(), admin.address, franchiseAdmin.address, franchiseMinter.address, approver.address, pauser.address);
    await registry.waitForDeployment();
    await nft.connect(admin).setRegistry(await registry.getAddress());
    await legion.connect(legionMinter).mintCountry(applicant.address, 'Test Country', 'test-country', 1n, 'ipfs://test-only/country.json');
  });

  async function minted() {
    await registry.connect(applicant).submitApplication(1n, uri);
    await registry.connect(franchiseAdmin).approveApplication(1n);
    await registry.connect(franchiseMinter).mintApprovedApplication(1n);
    return 1n;
  }

  it('binds a real canonical Legion token to one active independently owned Franchise assignment', async () => {
    const tokenId = await minted();
    const record = await registry.getFranchise(tokenId);
    expect(record.legionContract).to.equal(await legion.getAddress());
    expect(record.legionTokenId).to.equal(1n);
    expect(record.operator).to.equal(applicant.address);
    expect(record.status).to.equal(0n);
    expect(await nft.ownerOf(tokenId)).to.equal(applicant.address);
    expect(await registry.activeFranchiseForLegionToken(1n)).to.equal(tokenId);
    await expect(registry.connect(outsider).submitApplication(1n, uri)).to.be.revertedWithCustomError(registry, 'ActiveFranchise');
    await legion.connect(applicant).requestTransfer(1n, buyer.address);
    await legion.connect(admin).approveTransfer(1n);
    await legion.connect(applicant).executeTransfer(1n);
    expect(await legion.ownerOf(1n)).to.equal(buyer.address);
    expect(await nft.ownerOf(tokenId)).to.equal(applicant.address);
  });

  it('requires a valid existing Legion territory, applicant-controlled application, administrative approval, and separated minter', async () => {
    await expect(registry.connect(applicant).submitApplication(77n, uri)).to.be.revertedWithCustomError(registry, 'InvalidLegionTerritory');
    await registry.connect(applicant).submitApplication(1n, uri);
    await expect(registry.connect(outsider).approveApplication(1n)).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    await expect(registry.connect(outsider).mintApprovedApplication(1n)).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    await registry.connect(franchiseAdmin).approveApplication(1n);
    await registry.connect(franchiseMinter).mintApprovedApplication(1n);
    await expect(registry.connect(applicant).cancelApplication(1n)).to.be.revertedWithCustomError(registry, 'ApplicationNotPending');
  });

  it('prevents direct ERC-721 bypass and executes only an approved owner-controlled transfer', async () => {
    const tokenId = await minted();
    await expect(nft.connect(applicant).transferFrom(applicant.address, buyer.address, tokenId)).to.be.revertedWithCustomError(nft, 'DirectTransferForbidden');
    await expect(nft.connect(applicant).approve(buyer.address, tokenId)).to.be.revertedWithCustomError(nft, 'DirectApprovalForbidden');
    await registry.connect(applicant).requestTransfer(tokenId, buyer.address);
    await expect(registry.connect(outsider).executeTransfer(1n)).to.be.revertedWithCustomError(registry, 'TransferRequestNotApproved');
    await registry.connect(approver).approveTransfer(1n);
    await registry.connect(applicant).executeTransfer(1n);
    expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);
    expect((await registry.getFranchise(tokenId)).operator).to.equal(buyer.address);
    await expect(registry.connect(applicant).executeTransfer(1n)).to.be.revertedWithCustomError(registry, 'TransferRequestNotFound');
  });

  it('enforces active-only transfers, terminal revocation, and releases only the active-territory assignment slot', async () => {
    const tokenId = await minted();
    await registry.connect(franchiseAdmin).suspend(tokenId);
    await expect(registry.connect(applicant).requestTransfer(tokenId, buyer.address)).to.be.revertedWithCustomError(registry, 'InvalidLifecycleTransition');
    await registry.connect(franchiseAdmin).reactivate(tokenId);
    await registry.connect(franchiseAdmin).revoke(tokenId);
    expect((await registry.getFranchise(tokenId)).status).to.equal(2n);
    expect(await registry.activeFranchiseForLegionToken(1n)).to.equal(0n);
    await expect(registry.connect(franchiseAdmin).reactivate(tokenId)).to.be.revertedWithCustomError(registry, 'InvalidLifecycleTransition');
    await registry.connect(outsider).submitApplication(1n, uri);
    expect(await registry.activeApplicationForLegionToken(1n)).to.equal(2n);
  });

  it('blocks the approved state-changing surface while paused but retains safe application cancellation', async () => {
    await registry.connect(applicant).submitApplication(1n, uri);
    await registry.connect(pauser).pause();
    await expect(registry.connect(franchiseAdmin).approveApplication(1n)).to.be.revertedWithCustomError(registry, 'EnforcedPause');
    await expect(registry.connect(applicant).submitApplication(1n, uri)).to.be.revertedWithCustomError(registry, 'EnforcedPause');
    await registry.connect(applicant).cancelApplication(1n);
    await expect(registry.connect(outsider).unpause()).to.be.revertedWithCustomError(registry, 'AccessControlUnauthorizedAccount');
    await registry.connect(pauser).unpause();
  });

  it('has no payable price, fee, revenue, or marketplace path', async () => {
    let rejected = false;
    try {
      await registry.connect(applicant).submitApplication(1n, uri, { value: 1n });
    } catch {
      rejected = true;
    }
    expect(rejected).to.equal(true);
    await expect(nft.connect(outsider).mintFromRegistry(applicant.address, 1n, uri)).to.be.revertedWithCustomError(nft, 'OnlyRegistry');
  });

  it('updates metadata through the Registry only and preserves on-chain tokenURI provenance', async () => {
    const tokenId = await minted();
    const replacement = 'ipfs://test-only/franchise-v2-revised.json';
    await expect(nft.connect(applicant).updateMetadataFromRegistry(tokenId, replacement)).to.be.revertedWithCustomError(nft, 'OnlyRegistry');
    await registry.connect(franchiseAdmin).updateMetadata(tokenId, replacement);
    expect(await nft.tokenURI(tokenId)).to.equal(replacement);
    expect((await registry.getFranchise(tokenId)).metadataURI).to.equal(replacement);
  });

  it('rejects receiver-callback reentrancy during the Registry-controlled transfer', async () => {
    const tokenId = await minted();
    const receiver = await (await hh.getContractFactory('ReentrantFranchiseReceiver')).deploy(await registry.getAddress());
    await receiver.waitForDeployment();
    await registry.connect(applicant).requestTransfer(tokenId, await receiver.getAddress());
    await registry.connect(approver).approveTransfer(1n);
    await receiver.arm(tokenId, buyer.address);
    await registry.connect(applicant).executeTransfer(1n);
    expect(await receiver.attempted()).to.equal(true);
    expect(await receiver.succeeded()).to.equal(false);
    expect(await nft.ownerOf(tokenId)).to.equal(await receiver.getAddress());
    expect((await registry.getFranchise(tokenId)).operator).to.equal(await receiver.getAddress());
  });
});
