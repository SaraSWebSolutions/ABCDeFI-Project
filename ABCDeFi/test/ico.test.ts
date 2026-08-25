import { expect } from "chai";
import { network } from "hardhat";

describe("ABCD ICO Flow", function () {
  it("should deploy token and distribute allocations", async function () {
    const { ethers } = await network.connect();

    const [owner] = await ethers.getSigners();

    const ABCD = await ethers.getContractFactory(
      "contracts/token/ABCDToken.sol:ABCDToken"
    );

    const token = await ABCD.deploy(
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address,
      owner.address
    );

    await token.waitForDeployment();

    const balFounder = await token.balanceOf(owner.address);

    expect(balFounder).to.be.gt(0n);
  });
});
