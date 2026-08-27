import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

describe("FranchiseNFT", function () {
  let hh: any;
  let franchise: any;
  let admin: any;
  let minter: any;
  let holder: any;
  let recipient: any;

  const mint = async (target = holder.address, territoryCode = "IN-TG-HYD") => franchise.connect(minter).mintFranchise(
    target,
    "Hyderabad District Licence",
    territoryCode,
    "Hyderabad, Telangana, India",
    5,
    0,
    10_000,
    6,
    "ipfs://bafy-franchise-hyderabad/metadata.json",
    "bafy-franchise-hyderabad",
  );

  beforeEach(async function () {
    hh = (await network.connect()).ethers;
    [admin, minter, holder, recipient] = await hh.getSigners();
    const factory = await hh.getContractFactory("FranchiseNFT");
    franchise = await factory.deploy(admin.address, minter.address);
    await franchise.waitForDeployment();
  });

  it("assigns canonical administration and minting roles", async function () {
    expect(await franchise.hasRole(await franchise.DEFAULT_ADMIN_ROLE(), admin.address)).to.equal(true);
    expect(await franchise.hasRole(await franchise.MINTER_ROLE(), minter.address)).to.equal(true);
    expect(await franchise.hasRole(await franchise.PAUSER_ROLE(), admin.address)).to.equal(true);
    expect(await franchise.hasRole(await franchise.UPDATER_ROLE(), admin.address)).to.equal(true);
  });

  it("mints a unique territory certificate and persists its real details", async function () {
    await expect(mint()).to.emit(franchise, "FranchiseNFTMinted");
    expect(await franchise.ownerOf(1)).to.equal(holder.address);
    expect(await franchise.tokenURI(1)).to.equal("ipfs://bafy-franchise-hyderabad/metadata.json");
    const details = await franchise.getFranchiseDetails(1);
    expect(details.franchiseId).to.equal(1);
    expect(details.territoryCode).to.equal("IN-TG-HYD");
    expect(details.franchiseeWallet).to.equal(holder.address);
    expect(details.status).to.equal(0);
    expect(await franchise.isTransferLocked(1)).to.equal(true);
  });

  it("rejects unauthorized minting and duplicate territory codes", async function () {
    await expect(franchise.connect(holder).mintFranchise(holder.address, "x", "IN-TG-HYD", "x", 5, 0, 1, 6, "ipfs://x", "x"))
      .to.be.revertedWithCustomError(franchise, "AccessControlUnauthorizedAccount");
    await mint();
    await expect(mint(recipient.address)).to.be.revertedWith("Territory already minted");
  });

  it("enforces the three-year transfer lock and updates the recorded owner after expiry", async function () {
    await mint();
    await expect(franchise.connect(holder).transferFrom(holder.address, recipient.address, 1)).to.be.revertedWith("Franchise NFT locked for 3 years from purchase");
    await hh.provider.send("evm_increaseTime", [1095 * 24 * 60 * 60 + 1]);
    await hh.provider.send("evm_mine", []);
    await franchise.connect(holder).transferFrom(holder.address, recipient.address, 1);
    expect(await franchise.ownerOf(1)).to.equal(recipient.address);
    expect((await franchise.getFranchiseDetails(1)).franchiseeWallet).to.equal(recipient.address);
    expect(await franchise.isTransferLocked(1)).to.equal(false);
  });

  it("rejects malformed mint inputs enforced by the deployed contract", async function () {
    await expect(franchise.connect(minter).mintFranchise(ethers.ZeroAddress, "x", "IN-TG-HYD", "x", 5, 0, 1, 6, "ipfs://x", "x"))
      .to.be.revertedWith("Invalid franchisee address");
    await expect(franchise.connect(minter).mintFranchise(holder.address, "x", "", "x", 5, 0, 1, 6, "ipfs://x", "x"))
      .to.be.revertedWith("Territory code required");
  });
});
