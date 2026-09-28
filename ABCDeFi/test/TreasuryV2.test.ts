import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

describe("TreasuryV2 non-economic foundation", function () {
  let hh: any; let treasury: any; let token: any;
  let admin: any; let assetManager: any; let funderManager: any; let operator: any; let recipientManager: any; let pauser: any; let unpauser: any; let funder: any; let recipient: any; let outsider: any;
  const operation = (name: string) => ethers.keccak256(ethers.toUtf8Bytes(name));

  beforeEach(async function () {
    hh = (await network.connect()).ethers;
    [admin, assetManager, funderManager, operator, recipientManager, pauser, unpauser, funder, recipient, outsider] = await hh.getSigners();
    const Token = await hh.getContractFactory("ABCDToken");
    token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    await token.waitForDeployment();
    const Treasury = await hh.getContractFactory("TreasuryV2");
    treasury = await Treasury.deploy(await token.getAddress(), admin.address, assetManager.address, funderManager.address, operator.address, recipientManager.address, pauser.address, unpauser.address);
    await treasury.waitForDeployment();
  });

  it("uses separated roles and only configured ERC20 assets", async function () {
    expect(await treasury.supportedAsset(await token.getAddress())).to.equal(true);
    await expect(treasury.connect(outsider).configureAsset(await token.getAddress(), true)).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    await expect(treasury.connect(assetManager).configureAsset(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(treasury, "InvalidAddress");
  });

  it("records an authorized exact-balance funding operation and rejects replay", async function () {
    const amount = ethers.parseUnits("25", 18); const id = operation("fund-1");
    await token.connect(admin).transfer(funder.address, amount);
    await token.connect(funder).approve(await treasury.getAddress(), amount);
    await expect(treasury.connect(funder).fund(await token.getAddress(), amount, id)).to.be.revertedWithCustomError(treasury, "UnauthorizedFunder");
    await treasury.connect(funderManager).configureFunder(funder.address, true);
    await expect(treasury.connect(funder).fund(await token.getAddress(), amount, id)).to.emit(treasury, "TreasuryFunded").withArgs(id, await token.getAddress(), funder.address, amount, amount);
    expect(await treasury.accountedBalance(await token.getAddress())).to.equal(amount);
    await expect(treasury.connect(funder).fund(await token.getAddress(), amount, id)).to.be.revertedWithCustomError(treasury, "OperationAlreadyProcessed");
  });

  it("requires recipient authorization, operator authority, and consumes outbound operations", async function () {
    const amount = ethers.parseUnits("25", 18); const fundId = operation("fund-2"); const payoutId = operation("payout-2");
    await treasury.connect(funderManager).configureFunder(funder.address, true);
    await token.connect(admin).transfer(funder.address, amount); await token.connect(funder).approve(await treasury.getAddress(), amount);
    await treasury.connect(funder).fund(await token.getAddress(), amount, fundId);
    await expect(treasury.connect(outsider).executeTransfer(await token.getAddress(), recipient.address, amount, payoutId)).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    await expect(treasury.connect(operator).executeTransfer(await token.getAddress(), recipient.address, amount, payoutId)).to.be.revertedWithCustomError(treasury, "UnauthorizedRecipient");
    await treasury.connect(recipientManager).configureRecipient(recipient.address, true);
    await expect(treasury.connect(operator).executeTransfer(await token.getAddress(), recipient.address, amount, payoutId)).to.emit(treasury, "TreasuryTransferExecuted").withArgs(payoutId, await token.getAddress(), recipient.address, amount, 0);
    expect(await token.balanceOf(recipient.address)).to.equal(amount);
    await expect(treasury.connect(operator).executeTransfer(await token.getAddress(), recipient.address, amount, payoutId)).to.be.revertedWithCustomError(treasury, "OperationAlreadyProcessed");
  });

  it("fails closed on unaccounted asset transfers and supports narrow pause roles", async function () {
    const amount = ethers.parseUnits("1", 18);
    await token.connect(admin).transfer(await treasury.getAddress(), amount);
    expect(await treasury.unaccountedBalance(await token.getAddress())).to.equal(amount);
    await treasury.connect(funderManager).configureFunder(funder.address, true);
    await token.connect(admin).transfer(funder.address, amount); await token.connect(funder).approve(await treasury.getAddress(), amount);
    await expect(treasury.connect(funder).fund(await token.getAddress(), amount, operation("mismatch"))).to.be.revertedWithCustomError(treasury, "AccountingMismatch");
    await treasury.connect(pauser).pause();
    await expect(treasury.connect(funderManager).configureFunder(funder.address, true)).to.be.revertedWithCustomError(treasury, "EnforcedPause");
    await expect(treasury.connect(outsider).unpause()).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
    await treasury.connect(unpauser).unpause();
  });
});
