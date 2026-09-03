import { expect } from "chai";
import { network } from "hardhat";
import { ethers } from "ethers";

let hardhatEthers: any;

beforeEach(async function () {
  hardhatEthers = (await network.connect()).ethers;
});

import { ABCDToken } from "../typechain-types";

describe(
  "Phase 1: Step 1 - ABCD Token Specification Verification",
  function () {
    let token: ABCDToken;

    let owner: any;
    let infrastructure: any;
    let liquidity: any;
    let marketing: any;
    let contractsWallet: any;
    let community: any;
    let education: any;
    let contingency: any;
    let reserve: any;
    let user1: any;
    let user2: any;

    const ONE_BILLION = ethers.parseEther("1000000000");

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
        user1,
        user2,
      ] = await hardhatEthers.getSigners();

      const TokenFactory =
        await hardhatEthers.getContractFactory(
          "ABCDToken"
        );

      token = (await TokenFactory.deploy(
        infrastructure.address,
        liquidity.address,
        marketing.address,
        contractsWallet.address,
        community.address,
        education.address,
        contingency.address,
        reserve.address
      )) as ABCDToken;

      await token.waitForDeployment();
    });

    describe("Token Metadata & Fixed Supply", function () {
      it("Should have correct token name and symbol", async function () {
        expect(await token.name()).to.equal(
          "ABCDeFi Core Token"
        );

        expect(await token.symbol()).to.equal(
          "ABCD"
        );
      });

      it("Should have 18 decimals", async function () {
        expect(await token.decimals()).to.equal(18);
      });

      it("Should have a fixed total supply of exactly 1 Billion ABCD", async function () {
        const totalSupply =
          await token.totalSupply();

        expect(totalSupply).to.equal(
          ONE_BILLION
        );

        expect(await token.maxSupply()).to.equal(
          ONE_BILLION
        );
      });

      it("Should allocate the full supply across all eight ecosystem wallets according to BPS percentages", async function () {
        const infrastructureBal =
          await token.balanceOf(
            infrastructure.address
          );

        const liquidityBal =
          await token.balanceOf(
            liquidity.address
          );

        const marketingBal =
          await token.balanceOf(
            marketing.address
          );

        const contractsBal =
          await token.balanceOf(
            contractsWallet.address
          );

        const communityBal =
          await token.balanceOf(
            community.address
          );

        const educationBal =
          await token.balanceOf(
            education.address
          );

        const contingencyBal =
          await token.balanceOf(
            contingency.address
          );

        const reserveBal =
          await token.balanceOf(
            reserve.address
          );

        expect(infrastructureBal).to.equal(
          (ONE_BILLION * 1500n) / 10000n
        ); // 15%

        expect(liquidityBal).to.equal(
          (ONE_BILLION * 4000n) / 10000n
        ); // 40%

        expect(marketingBal).to.equal(
          (ONE_BILLION * 500n) / 10000n
        ); // 5%

        expect(contractsBal).to.equal(
          (ONE_BILLION * 1500n) / 10000n
        ); // 15%

        expect(communityBal).to.equal(
          (ONE_BILLION * 500n) / 10000n
        ); // 5%

        expect(educationBal).to.equal(
          (ONE_BILLION * 1000n) / 10000n
        ); // 10%

        expect(contingencyBal).to.equal(
          (ONE_BILLION * 800n) / 10000n
        ); // 8%

        expect(reserveBal).to.equal(
          (ONE_BILLION * 200n) / 10000n
        ); // 2%

        const total =
          infrastructureBal +
          liquidityBal +
          marketingBal +
          contractsBal +
          communityBal +
          educationBal +
          contingencyBal +
          reserveBal;

        expect(total).to.equal(
          ONE_BILLION
        );
      });
    });

    describe("Transfers & Approvals", function () {
      it("Should execute standard ERC-20 transfers", async function () {
        const amount =
          ethers.parseEther("1000");

        await token
          .connect(infrastructure)
          .transfer(
            user1.address,
            amount
          );

        expect(
          await token.balanceOf(user1.address)
        ).to.equal(amount);
      });

      it("Should handle approvals and transferFrom", async function () {
        const amount =
          ethers.parseEther("500");

        await token
          .connect(infrastructure)
          .approve(
            user1.address,
            amount
          );

        expect(
          await token.allowance(
            infrastructure.address,
            user1.address
          )
        ).to.equal(amount);

        await token
          .connect(user1)
          .transferFrom(
            infrastructure.address,
            user2.address,
            amount
          );

        expect(
          await token.balanceOf(user2.address)
        ).to.equal(amount);
      });
    });

    describe("Burn Mechanism", function () {
      it("Should allow token holders to burn their own tokens", async function () {
        const burnAmount =
          ethers.parseEther("1000");

        await token
          .connect(infrastructure)
          .transfer(
            user1.address,
            burnAmount
          );

        const initialSupply =
          await token.totalSupply();

        await token
          .connect(user1)
          .burn(burnAmount);

        expect(
          await token.balanceOf(user1.address)
        ).to.equal(0n);

        expect(
          await token.totalSupply()
        ).to.equal(
          initialSupply - burnAmount
        );
      });

      it("Should allow treasury role to burn from treasury balance", async function () {
        const burnAmount =
          ethers.parseEther("5000");

        const initialSupply =
          await token.totalSupply();

        await token
          .connect(owner)
          .burnFromTreasury(
            burnAmount
          );

        expect(
          await token.totalSupply()
        ).to.equal(
          initialSupply - burnAmount
        );
      });
    });

    describe("Owner & Role Controls", function () {
      it("Should allow PAUSER_ROLE to pause and unpause token transfers", async function () {
        await token
          .connect(owner)
          .pause();

        expect(
          await token.isPaused()
        ).to.equal(true);

        const amount =
          ethers.parseEther("100");

        await expect(
          token
            .connect(infrastructure)
            .transfer(
              user1.address,
              amount
            )
        ).to.be.revertedWithCustomError(
          token,
          "EnforcedPause"
        );

        await token
          .connect(owner)
          .unpause();

        expect(
          await token.isPaused()
        ).to.equal(false);

        await expect(
          token
            .connect(infrastructure)
            .transfer(
              user1.address,
              amount
            )
        ).to.emit(
          token,
          "Transfer"
        );
      });

      it("Should revert minting if it exceeds 1 Billion max supply", async function () {
        await expect(
          token
            .connect(owner)
            .mint(
              user1.address,
              1n
            )
        ).to.be.revertedWithCustomError(
          token,
          "MaxSupplyExceeded"
        );
      });
    });
  }
);