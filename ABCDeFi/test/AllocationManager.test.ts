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
  let infrastructure: any;
  let liquidity: any;
  let marketing: any;
  let contractsWallet: any;
  let community: any;
  let education: any;
  let reserve: any;
  let contingency: any;
  let newWallet: any;

  beforeEach(async function () {
    [
      owner,
      infrastructure,
      liquidity,
      marketing,
      contractsWallet,
      community,
      education,
      contingency,
      reserve,
      newWallet,
    ] = await hardhatEthers.getSigners();

    const Factory = await hardhatEthers.getContractFactory("AllocationManager");
    allocationManager = await Factory.deploy(
      infrastructure.address,
      liquidity.address,
      marketing.address,
      contractsWallet.address,
      community.address,
      education.address,
      contingency.address,
      reserve.address
    );
    await allocationManager.waitForDeployment();
  });

  it("initializes all eight allocations with the 15/40/5/15/5/10/8/2 BPS model", async function () {
    const expected = [
      ["INFRASTRUCTURE", infrastructure.address, 1500n],
      ["LIQUIDITY", liquidity.address, 4000n],
      ["MARKETING", marketing.address, 500n],
      ["CONTRACTS", contractsWallet.address, 1500n],
      ["COMMUNITY", community.address, 500n],
      ["EDUCATION", education.address, 1000n],
      ["CONTINGENCY", contingency.address, 800n],
      ["RESERVE", reserve.address, 200n],
    ] as const;

    expect(await allocationManager.allocationCount()).to.equal(8n);
    const keys = await allocationManager.getAllocationKeys();
    expect(keys).to.have.length(8);

    let totalBps = 0n;
    for (const [name, wallet, bps] of expected) {
      const key = ethers.keccak256(ethers.toUtf8Bytes(name));
      const allocation = await allocationManager.getAllocation(key);
      expect(allocation.name).to.equal(name);
      expect(allocation.wallet).to.equal(wallet);
      expect(allocation.bps).to.equal(bps);
      expect(allocation.amount).to.equal((ethers.parseEther("1000000000") * bps) / 10000n);
      expect(allocation.frozen).to.equal(false);
      totalBps += allocation.bps;
    }
    expect(totalBps).to.equal(10000n);
  });

  it("Should update ecosystem wallet addresses", async function () {
    const liquidityKey = ethers.keccak256(ethers.toUtf8Bytes("LIQUIDITY"));
    await allocationManager.updateAllocation(liquidityKey, newWallet.address);

    const updated = await allocationManager.getAllocation(liquidityKey);
    expect(updated.wallet).to.equal(newWallet.address);
  });

  it("Should freeze allocation and block updates/transfers when frozen", async function () {
    const mktgKey = ethers.keccak256(ethers.toUtf8Bytes("MARKETING"));

    await allocationManager.freezeAllocation(mktgKey);
    expect((await allocationManager.getAllocation(mktgKey)).frozen).to.equal(true);

    await expect(
      allocationManager.updateAllocation(mktgKey, newWallet.address)
    ).to.be.revertedWithCustomError(allocationManager, "UnauthorizedAccount");

    await allocationManager.unfreezeAllocation(mktgKey);
    const oldWallet = (await allocationManager.getAllocation(mktgKey)).wallet;
    await expect(
      allocationManager.updateAllocation(mktgKey, newWallet.address)
    )
      .to.emit(allocationManager, "AllocationUpdated")
      .withArgs(
        mktgKey,
        oldWallet,
        newWallet.address,
        (ethers.parseEther("1000000000") * 500n) / 10000n,
        (ethers.parseEther("1000000000") * 500n) / 10000n
      );
  });
});
