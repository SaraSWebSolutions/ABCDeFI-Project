import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

describe("Canonical inactive ICO configuration", () => {
  it("cannot start or sell from a Presale without an explicitly approved sale configuration", async () => {
    const { ethers: hh } = await network.connect();
    const [admin, buyer] = await hh.getSigners();
    const Token = await hh.getContractFactory("ABCDToken");
    const token = await Token.deploy(admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address, admin.address);
    await token.waitForDeployment();
    const Treasury = await hh.getContractFactory("Treasury");
    const treasury = await Treasury.deploy({ devWallet: admin.address, liquidityVault: admin.address, marketingVault: admin.address, contractsVault: admin.address, communityVault: admin.address, educationVault: admin.address, contingencyVault: admin.address, reserveVault: admin.address }, admin.address);
    await treasury.waitForDeployment();
    const Presale = await hh.getContractFactory("Presale");
    const presale = await Presale.deploy(await token.getAddress(), await treasury.getAddress(), ethers.parseUnits("1000", 18), ethers.parseEther("10"), ethers.parseEther("100"), ethers.parseEther("0.1"), ethers.parseEther("10"), admin.address, false);
    await presale.waitForDeployment();
    const block = await hh.provider.getBlock("latest");
    expect(await presale.saleEnabled()).to.equal(false);
    expect(await token.maxSupply()).to.equal(ethers.parseUnits("1000000000", 18));
    expect(await token.totalSupply()).to.equal(ethers.parseUnits("1000000000", 18));
    await expect(presale.startPresale(block.timestamp, block.timestamp + 3600)).to.be.revertedWith("sale configuration inactive");
    await expect(presale.connect(buyer).buyWithETH({ value: ethers.parseEther("0.1") })).to.be.revertedWithCustomError(presale, "PresaleNotActive");
    expect(await presale.totalEthRaised()).to.equal(0n);
    expect(await presale.totalTokensSold()).to.equal(0n);
    expect(await token.totalSupply()).to.equal(ethers.parseUnits("1000000000", 18));
  });
});
