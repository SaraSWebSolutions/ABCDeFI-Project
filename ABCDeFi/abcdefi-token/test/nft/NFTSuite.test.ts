import { expect } from "chai";
import { ethers } from "hardhat";
import { LoanNFT, GuruNFT, ParticipantNFT, ReputationNFT, BarterNFT } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ABCDeFi NFT Smart Contract Suite", function () {
  let loanNFT: LoanNFT;
  let guruNFT: GuruNFT;
  let participantNFT: ParticipantNFT;
  let reputationNFT: ReputationNFT;
  let barterNFT: BarterNFT;

  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, admin, user1, user2] = await ethers.getSigners();

    const LoanFactory = await ethers.getContractFactory("LoanNFT");
    loanNFT = await LoanFactory.deploy(admin.address);

    const GuruFactory = await ethers.getContractFactory("GuruNFT");
    guruNFT = await GuruFactory.deploy(admin.address);

    const ParticipantFactory = await ethers.getContractFactory("ParticipantNFT");
    participantNFT = await ParticipantFactory.deploy(admin.address);

    const ReputationFactory = await ethers.getContractFactory("ReputationNFT");
    reputationNFT = await ReputationFactory.deploy(admin.address);

    const BarterFactory = await ethers.getContractFactory("BarterNFT");
    barterNFT = await BarterFactory.deploy(admin.address);

    await Promise.all([
      loanNFT.waitForDeployment(),
      guruNFT.waitForDeployment(),
      participantNFT.waitForDeployment(),
      reputationNFT.waitForDeployment(),
      barterNFT.waitForDeployment(),
    ]);
  });

  describe("1. LoanNFT", function () {
    it("should mint loan certificate NFT and return details", async function () {
      await loanNFT.connect(admin).mintLoanNFT(
        user1.address,
        101,
        ethers.parseUnits("5000", 18),
        ethers.parseEther("2.5"),
        "ipfs://loan-101"
      );

      expect(await loanNFT.ownerOf(1)).to.equal(user1.address);
      const details = await loanNFT.getLoanNFTDetails(1);
      expect(details.loanId).to.equal(101);
      expect(details.principalAmount).to.equal(ethers.parseUnits("5000", 18));
    });
  });

  describe("2. GuruNFT", function () {
    it("should mint advisor badge and update tier from Bronze to Gold", async function () {
      await guruNFT.connect(admin).mintGuruNFT(user1.address, 0, "DeFi Yield Specialist", "ipfs://guru-1");

      let details = await guruNFT.getGuruDetails(1);
      expect(details.tier).to.equal(0); // BRONZE

      await guruNFT.connect(admin).updateGuruTier(1, 2); // GOLD
      details = await guruNFT.getGuruDetails(1);
      expect(details.tier).to.equal(2); // GOLD
    });
  });

  describe("3. ParticipantNFT", function () {
    it("should mint milestone badge", async function () {
      await participantNFT.connect(admin).mintParticipantNFT(user1.address, "Presale Milestone Phase 1", 1, "ipfs://participant-1");
      expect(await participantNFT.ownerOf(1)).to.equal(user1.address);
    });
  });

  describe("4. ReputationNFT (Soulbound)", function () {
    it("should mint credit score certificate and prevent P2P transfers", async function () {
      await reputationNFT.connect(admin).mintReputationNFT(user1.address, 750, "ipfs://rep-1");

      const data = await reputationNFT.getReputation(1);
      expect(data.creditScore).to.equal(750);

      // Attempting to transfer Soulbound token must revert
      await expect(
        reputationNFT.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.reverted;
    });
  });

  describe("5. BarterNFT", function () {
    it("should create and execute peer-to-peer barter trade voucher", async function () {
      await barterNFT.connect(user1).createBarterNFT(
        user1.address,
        ethers.parseUnits("1000", 18),
        ethers.parseUnits("1200", 18),
        "ipfs://barter-1"
      );

      let agreement = await barterNFT.getBarterAgreement(1);
      expect(agreement.status).to.equal(0); // OPEN

      await barterNFT.connect(user1).executeBarter(1, user2.address);
      agreement = await barterNFT.getBarterAgreement(1);
      expect(agreement.status).to.equal(1); // EXECUTED
      expect(agreement.partyB).to.equal(user2.address);
    });
  });
});
