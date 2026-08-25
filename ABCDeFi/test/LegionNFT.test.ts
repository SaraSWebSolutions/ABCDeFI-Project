import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;
beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

describe("LegionNFT Contract Suite", function () {
  let legionNFT: any;
  let owner: any;
  let minter: any;
  let user1: any;

  beforeEach(async function () {
    [owner, minter, user1] = await hardhatEthers.getSigners();

    const LegionNFTFactory = await hardhatEthers.getContractFactory("LegionNFT");
    legionNFT = await LegionNFTFactory.deploy(owner.address, minter.address);
    await legionNFT.waitForDeployment();
  });

  it("should deploy with correct name, symbol, and roles", async function () {
    expect(await legionNFT.name()).to.equal("ABCDeFi Legion NFT");
    expect(await legionNFT.symbol()).to.equal("LEGION");

    const MINTER_ROLE = await legionNFT.MINTER_ROLE();
    expect(await legionNFT.hasRole(MINTER_ROLE, minter.address)).to.be.true;
  });

  it("should execute Steps 17, 18, 19, 20 minting helpers and verify Phase 6 Hierarchy", async function () {
    // Step 17: mintContinent (Asia - NFT ID 1)
    await legionNFT.connect(minter).mintContinent(
      user1.address,
      "Asia",
      "Asian Continent",
      "Supreme Guardian",
      "https://api.abcdefi.com/nft/asia.json",
      4600000000,
      500
    );

    // Step 18: mintCountry (India - NFT ID 2 under Asia ID 1)
    await legionNFT.connect(minter).mintCountry(
      user1.address,
      "India",
      "Republic of India",
      1, // Parent = Asia (1)
      "Vanguard Commander",
      "https://api.abcdefi.com/nft/india.json",
      1400000000,
      300
    );

    // Step 19: mintState (Telangana - NFT ID 3 under India ID 2)
    await legionNFT.connect(minter).mintState(
      user1.address,
      "Telangana",
      "Telangana State",
      2, // Parent = India (2)
      "Regional Warlord",
      "https://api.abcdefi.com/nft/telangana.json",
      38000000,
      150
    );

    // Step 20: mintDistrict (Hyderabad - NFT ID 4 under Telangana ID 3)
    await legionNFT.connect(minter).mintDistrict(
      user1.address,
      "Hyderabad",
      "Hyderabad District",
      3, // Parent = Telangana (3)
      "District Knight",
      "https://api.abcdefi.com/nft/hyderabad.json",
      10000000,
      50
    );

    // Phase 6 Hierarchy Check for Asia (NFT ID 1)
    const [asiaParent, asiaChildren] = await legionNFT.getLegionHierarchy(1);
    expect(asiaParent).to.equal(0); // Parent: None
    expect(asiaChildren.length).to.equal(1);
    expect(asiaChildren[0]).to.equal(2); // Child: India (2)

    // Phase 6 Hierarchy Check for India (NFT ID 2)
    const [indiaParent, indiaChildren] = await legionNFT.getLegionHierarchy(2);
    expect(indiaParent).to.equal(1); // Parent: Asia (1)
    expect(indiaChildren.length).to.equal(1);
    expect(indiaChildren[0]).to.equal(3); // Child: Telangana (3)

    // Phase 6 Hierarchy Check for Telangana (NFT ID 3)
    const [telanganaParent, telanganaChildren] = await legionNFT.getLegionHierarchy(3);
    expect(telanganaParent).to.equal(2); // Parent: India (2)
    expect(telanganaChildren.length).to.equal(1);
    expect(telanganaChildren[0]).to.equal(4); // Child: Hyderabad (4)

    // Phase 6 Hierarchy Check for Hyderabad (NFT ID 4)
    const [hyderabadParent, hyderabadChildren] = await legionNFT.getLegionHierarchy(4);
    expect(hyderabadParent).to.equal(3); // Parent: Telangana (3)
    expect(hyderabadChildren.length).to.equal(0); // Children: None
  });

  it("should support batch minting functions (batchMintCountry, batchMintState, batchMintDistrict)", async function () {
    // Step 17: Mint Asia (ID 1)
    await legionNFT.connect(minter).mintContinent(
      user1.address, "Asia", "Asian Continent", "Guardian", "uri/asia", 4600000000, 500
    );

    // Step 18: batchMintCountry (India & Japan under Asia ID 1)
    await legionNFT.connect(minter).batchMintCountry(
      user1.address,
      [
        {
          name: "India",
          territory: "India Territory",
          parentId: 1,
          character: "Vanguard",
          metadataURI: "uri/india",
          population: 1400000000,
          treasuryShareBps: 300
        },
        {
          name: "Japan",
          territory: "Japan Territory",
          parentId: 1,
          character: "Vanguard",
          metadataURI: "uri/japan",
          population: 125000000,
          treasuryShareBps: 300
        }
      ]
    );

    expect(await legionNFT.totalLegions()).to.equal(3);

    // Verify Asia has 2 children: India (ID 2) and Japan (ID 3)
    const [, asiaChildren] = await legionNFT.getLegionHierarchy(1);
    expect(asiaChildren.length).to.equal(2);
    expect(asiaChildren[0]).to.equal(2);
    expect(asiaChildren[1]).to.equal(3);
  });

  it("should revert when attempting invalid level progression", async function () {
    // Mint Continent: Asia
    await legionNFT.connect(minter).mintContinent(
      user1.address, "Asia", "Asian Continent", "Guardian", "uri/asia", 4600000000, 500
    );

    // Attempting to mint District (Level 3) directly under Continent (Level 0) should revert
    await expect(
      legionNFT.connect(minter).mintDistrict(
        user1.address, "Hyderabad", "Hyderabad District", 1, "Knight", "uri/hyderabad", 10000000, 50
      )
    ).to.be.revertedWith("LegionNFT: Invalid hierarchy level progression");
  });
});
