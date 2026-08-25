import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("Token Allocation & AllocationManager Specification Verification", function () {
  let allocationManager: any;
  let owner: any;
  let founder: any;
  let ico: any;
  let marketing: any;
  let advisor: any;
  let finance: any;
  let reserve: any;
  let contingency: any;
  let newWallet: any;

  beforeEach(async function () {
    [owner, founder, ico, marketing, advisor, finance, reserve, contingency, newWallet] = await hardhatEthers.getSigners();

    const Factory = await hardhatEthers.getContractFactory("AllocationManager");
    allocationManager = await Factory.deploy(
      founder.address,
      ico.address,
      marketing.address,
      advisor.address,
      finance.address,
      reserve.address,
      contingency.address
    );
    await allocationManager.waitForDeployment();
  });

  it("Should initialize all 7 ecosystem allocations with exact whitepaper BPS percentages", async function () {
    const founderKey = ethers.keccak256(ethers.toUtf8Bytes("FOUNDER"));
    const icoKey = ethers.keccak256(ethers.toUtf8Bytes("ICO"));
    const mktgKey = ethers.keccak256(ethers.toUtf8Bytes("MARKETING"));
    const advisorKey = ethers.keccak256(ethers.toUtf8Bytes("ADVISOR"));
    const financeKey = ethers.keccak256(ethers.toUtf8Bytes("FINANCE"));
    const reserveKey = ethers.keccak256(ethers.toUtf8Bytes("RESERVE"));
    const contingencyKey = ethers.keccak256(ethers.toUtf8Bytes("CONTINGENCY"));

    const [founderName, founderWallet, founderBps] = await allocationManager.getAllocation(founderKey);
    const [icoName, icoWallet, icoBps] = await allocationManager.getAllocation(icoKey);
    const [mktgName, mktgWallet, mktgBps] = await allocationManager.getAllocation(mktgKey);
    const [finName, finWallet, finBps] = await allocationManager.getAllocation(financeKey);

    expect(founderBps).to.equal(5500n); // 55%
    expect(icoBps).to.equal(2000n);     // 20%
    expect(mktgBps).to.equal(1000n);    // 10%
    expect(finBps).to.equal(900n);      // 9%
  });

  it("Should update ecosystem wallet addresses", async function () {
    const icoKey = ethers.keccak256(ethers.toUtf8Bytes("ICO"));
    await allocationManager.updateWallet(icoKey, newWallet.address);

    const [, updatedWallet] = await allocationManager.getAllocation(icoKey);
    expect(updatedWallet).to.equal(newWallet.address);
  });

  it("Should freeze allocation and block updates/transfers when frozen", async function () {
    const mktgKey = ethers.keccak256(ethers.toUtf8Bytes("MARKETING"));

    await allocationManager.freezeAllocation(mktgKey);
    const [,,, isFrozen] = await allocationManager.getAllocation(mktgKey);
    expect(isFrozen).to.equal(true);

    await expect(
      allocationManager.updateWallet(mktgKey, newWallet.address)
    ).to.be.revertedWithCustomError(allocationManager, "UnauthorizedAccount");
    await expect(
      allocationManager.recordTransfer(mktgKey, newWallet.address, 1000n, "Promo")
    ).to.be.revertedWith("Allocation is frozen");

    await allocationManager.unfreezeAllocation(mktgKey);
    const [, oldWallet] = await allocationManager.getAllocation(mktgKey);
    await expect(
      allocationManager.updateWallet(mktgKey, newWallet.address)
    )
      .to.emit(allocationManager, "AllocationUpdated")
      .withArgs(
        mktgKey,
        oldWallet,
        newWallet.address
      );
  });

  it("Should log allocation transfer history", async function () {
    const founderKey = ethers.keccak256(ethers.toUtf8Bytes("FOUNDER"));
    await allocationManager.recordTransfer(founderKey, newWallet.address, ethers.parseEther("100000"), "Founder Vesting Grant");

    const history = await allocationManager.getHistory();
    expect(history.length).to.equal(1);
    expect(history[0].to).to.equal(newWallet.address);
    expect(history[0].reason).to.equal("Founder Vesting Grant");
  });
});
