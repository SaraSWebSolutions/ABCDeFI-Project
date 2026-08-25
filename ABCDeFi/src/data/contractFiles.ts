import { ContractFile } from '../types';

export const CONTRACT_FILES: ContractFile[] = [
  {
    id: 'token',
    name: 'ABCDToken.sol',
    path: 'contracts/token/ABCDToken.sol',
    language: 'solidity',
    description: 'Core ERC-20 token contract extending OpenZeppelin v5 ERC20, Burnable, Pausable, Permit, Ownable, and AccessControl.',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/IABCDToken.sol";

/**
 * @title ABCDToken
 * @notice Core ERC-20 token for the ABCDeFi ecosystem with AccessControl roles,
 *         hard-capped supply, minting/burning controls, treasury bookkeeping,
 *         and emergency rescue logic.
 */
contract ABCDToken is
    ERC20,
    ERC20Burnable,
    ERC20Pausable,
    ERC20Permit,
    Ownable,
    AccessControl,
    IABCDToken
{
    using SafeERC20 for IERC20;

    // --- State Variables ---
    address private _treasury;

    // Ecosystem Wallets
    address public founderWallet;
    address public icoWallet;
    address public marketingWallet;
    address public financeWallet;
    address public advisorWallet;
    address public reserveWallet;
    address public contingencyWallet;

    /**
     * @notice Constructs the ABCDToken and mints 100% of MAX_SUPPLY across ecosystem wallets.
     * @param founderWallet_ Wallet receiving 55% allocation (550,000,000 ABCD)
     * @param icoWallet_ Wallet receiving 20% allocation (200,000,000 ABCD)
     * @param marketingWallet_ Wallet receiving 10% allocation (100,000,000 ABCD)
     * @param financeWallet_ Wallet receiving 9% allocation (90,000,000 ABCD) - Default Treasury
     * @param advisorWallet_ Wallet receiving 2% allocation (20,000,000 ABCD)
     * @param reserveWallet_ Wallet receiving 2% allocation (20,000,000 ABCD)
     * @param contingencyWallet_ Wallet receiving 2% allocation (20,000,000 ABCD)
     */
    constructor(
        address founderWallet_,
        address icoWallet_,
        address marketingWallet_,
        address financeWallet_,
        address advisorWallet_,
        address reserveWallet_,
        address contingencyWallet_
    )
        ERC20(Constants.TOKEN_NAME, Constants.TOKEN_SYMBOL)
        ERC20Permit(Constants.TOKEN_NAME)
        Ownable(msg.sender)
    {
        // Address Validations
        if (
            founderWallet_ == address(0) ||
            icoWallet_ == address(0) ||
            marketingWallet_ == address(0) ||
            financeWallet_ == address(0) ||
            advisorWallet_ == address(0) ||
            reserveWallet_ == address(0) ||
            contingencyWallet_ == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        founderWallet = founderWallet_;
        icoWallet = icoWallet_;
        marketingWallet = marketingWallet_;
        financeWallet = financeWallet_;
        advisorWallet = advisorWallet_;
        reserveWallet = reserveWallet_;
        contingencyWallet = contingencyWallet_;

        // Treasury defaults to financeWallet_
        _treasury = financeWallet_;

        // Grant Roles to Deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.MINTER_ROLE, msg.sender);
        _grantRole(Constants.BURNER_ROLE, msg.sender);
        _grantRole(Constants.PAUSER_ROLE, msg.sender);

        // Grant TREASURY_ROLE to default treasury address
        _grantRole(Constants.TREASURY_ROLE, _treasury);

        // Calculate Allocations
        uint256 maxSup = Constants.MAX_SUPPLY;
        uint256 founderAmount     = (maxSup * Constants.FOUNDER_BPS) / Constants.BPS_DENOMINATOR;
        uint256 icoAmount         = (maxSup * Constants.ICO_BPS) / Constants.BPS_DENOMINATOR;
        uint256 marketingAmount   = (maxSup * Constants.MARKETING_BPS) / Constants.BPS_DENOMINATOR;
        uint256 financeAmount     = (maxSup * Constants.FINANCE_BPS) / Constants.BPS_DENOMINATOR;
        uint256 advisorAmount     = (maxSup * Constants.ADVISOR_BPS) / Constants.BPS_DENOMINATOR;
        uint256 reserveAmount     = (maxSup * Constants.RESERVE_BPS) / Constants.BPS_DENOMINATOR;
        uint256 contingencyAmount = (maxSup * Constants.CONTINGENCY_BPS) / Constants.BPS_DENOMINATOR;

        uint256 totalAllocated = founderAmount + icoAmount + marketingAmount + financeAmount +
                                 advisorAmount + reserveAmount + contingencyAmount;

        if (totalAllocated != maxSup) {
            revert Errors.AllocationMismatch(totalAllocated, maxSup);
        }

        // Mint Initial Allocations
        _mint(founderWallet, founderAmount);
        _mint(icoWallet, icoAmount);
        _mint(marketingWallet, marketingAmount);
        _mint(financeWallet, financeAmount);
        _mint(advisorWallet, advisorAmount);
        _mint(reserveWallet, reserveAmount);
        _mint(contingencyWallet, contingencyAmount);

        emit EcosystemWalletsUpdated(
            founderWallet, icoWallet, marketingWallet,
            financeWallet, advisorWallet, reserveWallet, contingencyWallet
        );
        emit TreasuryUpdated(address(0), _treasury);
    }

    // --- Core Mechanics ---

    /**
     * @notice Mints new ABCD tokens up to MAX_SUPPLY. Restricted to MINTER_ROLE.
     * @param to Target address receiving tokens
     * @param amount Token quantity in wei (18 decimals)
     */
    function mint(address to, uint256 amount)
        external
        override
        onlyRole(Constants.MINTER_ROLE)
    {
        if (to == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (totalSupply() + amount > Constants.MAX_SUPPLY) {
            revert Errors.MaxSupplyExceeded(amount, Constants.MAX_SUPPLY - totalSupply());
        }
        _mint(to, amount);
    }

    /**
     * @notice Burns ABCD tokens directly from the treasury wallet balance.
     *         Callable by accounts with BURNER_ROLE or TREASURY_ROLE.
     * @param amount Quantity of tokens to burn from treasury
     */
    function burnFromTreasury(uint256 amount) external override {
        if (!hasRole(Constants.BURNER_ROLE, msg.sender) && !hasRole(Constants.TREASURY_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, Constants.BURNER_ROLE);
        }
        if (amount == 0) revert Errors.ZeroAmount();
        if (balanceOf(_treasury) < amount) {
            revert Errors.InsufficientTreasuryBalance(amount, balanceOf(_treasury));
        }

        _burn(_treasury, amount);
        emit TreasuryBurn(_treasury, amount);
    }

    /**
     * @notice Pauses all token transfers, minting, and burning. Restricted to PAUSER_ROLE.
     */
    function pause() external override onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers, minting, and burning. Restricted to PAUSER_ROLE.
     */
    function unpause() external override onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }

    // --- Admin Operations ---

    /**
     * @notice Reassigns the active treasury address and grants TREASURY_ROLE to the new address.
     * @param newTreasury New treasury wallet address
     */
    function setTreasury(address newTreasury) external override onlyOwner {
        if (newTreasury == address(0)) revert Errors.InvalidAddress();
        address oldTreasury = _treasury;
        _treasury = newTreasury;

        _revokeRole(Constants.TREASURY_ROLE, oldTreasury);
        _grantRole(Constants.TREASURY_ROLE, newTreasury);

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Updates ecosystem wallet record references. Does NOT move existing tokens.
     */
    function updateWallets(
        address founderWallet_,
        address icoWallet_,
        address marketingWallet_,
        address financeWallet_,
        address advisorWallet_,
        address reserveWallet_,
        address contingencyWallet_
    ) external override onlyOwner {
        if (
            founderWallet_ == address(0) ||
            icoWallet_ == address(0) ||
            marketingWallet_ == address(0) ||
            financeWallet_ == address(0) ||
            advisorWallet_ == address(0) ||
            reserveWallet_ == address(0) ||
            contingencyWallet_ == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        founderWallet = founderWallet_;
        icoWallet = icoWallet_;
        marketingWallet = marketingWallet_;
        financeWallet = financeWallet_;
        advisorWallet = advisorWallet_;
        reserveWallet = reserveWallet_;
        contingencyWallet = contingencyWallet_;

        emit EcosystemWalletsUpdated(
            founderWallet, icoWallet, marketingWallet,
            financeWallet, advisorWallet, reserveWallet, contingencyWallet
        );
    }

    /**
     * @notice Rescues ERC-20 tokens accidentally sent to this contract address.
     */
    function rescueERC20(address token, address to, uint256 amount) external override onlyOwner {
        if (token == address(0) || to == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();

        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    /**
     * @notice Rescues native ETH accidentally sent to this contract address.
     */
    function rescueETH(address payable to, uint256 amount) external override onlyOwner {
        if (to == address(0)) revert Errors.InvalidAddress();
        if (amount == 0) revert Errors.ZeroAmount();
        if (address(this).balance < amount) revert Errors.ZeroAmount();

        (bool success, ) = to.call{value: amount}("");
        if (!success) revert Errors.NativeTransferFailed();

        emit NativeRescued(to, amount);
    }

    // --- Overrides ---

    /**
     * @dev Central hook for transfers, mints, and burns to enforce pausable restrictions.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }

    // --- View Functions ---

    function treasury() external view override returns (address) {
        return _treasury;
    }

    function isPaused() external view override returns (bool) {
        return paused();
    }

    function maxSupply() external view override returns (uint256) {
        return Constants.MAX_SUPPLY;
    }

    /// @dev Fallback to receive ETH for rescue test
    receive() external payable {}
}`
  },
  {
    id: 'interface',
    name: 'IABCDToken.sol',
    path: 'contracts/interfaces/IABCDToken.sol',
    language: 'solidity',
    description: 'External interface for other ecosystem contracts (ICO, VestingVault, LendingPool, Staking) to integrate with ABCDToken.',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IABCDToken
 * @notice External interface for the ABCDToken core smart contract used by ABCDeFi ecosystem contracts.
 */
interface IABCDToken is IERC20 {
    // --- Events ---
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);
    event EcosystemWalletsUpdated(
        address founderWallet,
        address icoWallet,
        address marketingWallet,
        address financeWallet,
        address advisorWallet,
        address reserveWallet,
        address contingencyWallet
    );
    event TokensRescued(address indexed token, address indexed to, uint256 amount);
    event NativeRescued(address indexed to, uint256 amount);
    event TreasuryBurn(address indexed treasury, uint256 amount);

    // --- Core Mechanics ---
    function mint(address to, uint256 amount) external;
    function burnFromTreasury(uint256 amount) external;
    function pause() external;
    function unpause() external;

    // --- Admin Operations ---
    function setTreasury(address newTreasury) external;
    function updateWallets(
        address founderWallet_,
        address icoWallet_,
        address marketingWallet_,
        address financeWallet_,
        address advisorWallet_,
        address reserveWallet_,
        address contingencyWallet_
    ) external;
    function rescueERC20(address token, address to, uint256 amount) external;
    function rescueETH(address payable to, uint256 amount) external;

    // --- View Functions ---
    function treasury() external view returns (address);
    function isPaused() external view returns (bool);
    function maxSupply() external view returns (uint256);

    // Ecosystem Wallets Getters
    function founderWallet() external view returns (address);
    function icoWallet() external view returns (address);
    function marketingWallet() external view returns (address);
    function financeWallet() external view returns (address);
    function advisorWallet() external view returns (address);
    function reserveWallet() external view returns (address);
    function contingencyWallet() external view returns (address);
}`
  },
  {
    id: 'constants',
    name: 'Constants.sol',
    path: 'contracts/libraries/Constants.sol',
    language: 'solidity',
    description: 'Token metadata, allocation basis points, and keccak256 role definitions.',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Constants
 * @notice Shared token metadata, allocation basis points, and role identifiers for ABCDToken.
 */
library Constants {
    // Token Metadata
    string public constant TOKEN_NAME = "ABCDeFi Core Token";
    string public constant TOKEN_SYMBOL = "ABCD";
    uint8 public constant TOKEN_DECIMALS = 18;

    // Supply Constants
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1,000,000,000 ABCD

    // Basis Points (Total = 10,000 BPS = 100%)
    uint256 public constant BPS_DENOMINATOR = 10_000;

    uint256 public constant FOUNDER_BPS     = 5500; // 55%  (550,000,000 ABCD)
    uint256 public constant ICO_BPS         = 2000; // 20%  (200,000,000 ABCD)
    uint256 public constant MARKETING_BPS   = 1000; // 10%  (100,000,000 ABCD)
    uint256 public constant FINANCE_BPS     = 900;  // 9%   (90,000,000 ABCD)
    uint256 public constant ADVISOR_BPS     = 200;  // 2%   (20,000,000 ABCD)
    uint256 public constant RESERVE_BPS     = 200;  // 2%   (20,000,000 ABCD)
    uint256 public constant CONTINGENCY_BPS = 200;  // 2%   (20,000,000 ABCD)

    // Role Identifiers
    bytes32 public constant MINTER_ROLE   = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE   = keccak256("BURNER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");
    bytes32 public constant PAUSER_ROLE   = keccak256("PAUSER_ROLE");
}`
  },
  {
    id: 'errors',
    name: 'Errors.sol',
    path: 'contracts/libraries/Errors.sol',
    language: 'solidity',
    description: 'Gas-optimized custom errors for allocation mismatches, supply caps, zero addresses, and role authorization.',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Errors
 * @notice Shared custom errors for the ABCDeFi token contract ecosystem.
 */
library Errors {
    /// @dev Thrown when the total initial allocation math does not sum to MAX_SUPPLY.
    error AllocationMismatch(uint256 calculatedTotal, uint256 expectedMaxSupply);

    /// @dev Thrown when minting would exceed MAX_SUPPLY.
    error MaxSupplyExceeded(uint256 requested, uint256 available);

    /// @dev Thrown when a provided address is invalid (e.g. address(0)).
    error InvalidAddress();

    /// @dev Thrown when attempting an action requiring unpaused state while paused.
    error TokenPaused();

    /// @dev Thrown when an account lacks a required AccessControl role.
    error UnauthorizedAccount(address account, bytes32 role);

    /// @dev Thrown when an operation is performed with a zero amount.
    error ZeroAmount();

    /// @dev Thrown when trying to burn from treasury without adequate balance.
    error InsufficientTreasuryBalance(uint256 requested, uint256 available);

    /// @dev Thrown when native ETH transfer fails during rescue.
    error NativeTransferFailed();
}`
  },
  {
    id: 'deploy',
    name: 'deploy.ts',
    path: 'scripts/deploy.ts',
    language: 'typescript',
    description: 'Environment-variable driven Hardhat deployment script for ABCDToken with full allocation logging.',
    content: `import { ethers } from "hardhat";

async function main() {
  console.log("==================================================");
  console.log("  ABCDToken Deployment Script — ABCDeFi Ecosystem  ");
  console.log("==================================================");

  const signers = await ethers.getSigners();
  const deployer = signers[0];

  console.log(\`Deploying with primary account: \${deployer.address}\`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(\`Deployer ETH balance: \${ethers.formatEther(balance)} ETH\`);

  // Wallet address resolution from environment variables or fallback test signers
  const founderWallet     = process.env.FOUNDER_WALLET     || signers[1]?.address || deployer.address;
  const icoWallet         = process.env.ICO_WALLET         || signers[2]?.address || deployer.address;
  const marketingWallet   = process.env.MARKETING_WALLET   || signers[3]?.address || deployer.address;
  const financeWallet     = process.env.FINANCE_WALLET     || signers[4]?.address || deployer.address;
  const advisorWallet     = process.env.ADVISOR_WALLET     || signers[5]?.address || deployer.address;
  const reserveWallet     = process.env.RESERVE_WALLET     || signers[6]?.address || deployer.address;
  const contingencyWallet = process.env.CONTINGENCY_WALLET || signers[7]?.address || deployer.address;

  console.log("\\n--- Configured Ecosystem Wallets ---");
  console.log(\`Founder Wallet (55%):     \${founderWallet}\`);
  console.log(\`ICO Wallet (20%):         \${icoWallet}\`);
  console.log(\`Marketing Wallet (10%):   \${marketingWallet}\`);
  console.log(\`Finance Wallet (9%):     \${financeWallet}\`);
  console.log(\`Advisor Wallet (2%):       \${advisorWallet}\`);
  console.log(\`Reserve Wallet (2%):       \${reserveWallet}\`);
  console.log(\`Contingency Wallet (2%):   \${contingencyWallet}\`);

  // Deploy Contract
  const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
  console.log("\\nDeploying ABCDToken contract...");

  const token = await ABCDTokenFactory.deploy(
    founderWallet,
    icoWallet,
    marketingWallet,
    financeWallet,
    advisorWallet,
    reserveWallet,
    contingencyWallet
  );

  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  console.log(\`\\n🎉 ABCDToken successfully deployed at address: \${tokenAddress}\`);

  // Read Metadata
  const name = await token.name();
  const symbol = await token.symbol();
  const decimals = await token.decimals();
  const totalSupply = await token.totalSupply();
  const treasury = await token.treasury();

  console.log("\\n--- Token Metadata ---");
  console.log(\`Token Name:   \${name}\`);
  console.log(\`Symbol:       \${symbol}\`);
  console.log(\`Decimals:     \${decimals}\`);
  console.log(\`Total Supply: \${ethers.formatUnits(totalSupply, decimals)} ABCD\`);
  console.log(\`Treasury:     \${treasury}\`);

  // Print Initial Balances
  console.log("\\n--- Initial Wallet Balances ---");
  console.log(\`Founder:     \${ethers.formatUnits(await token.balanceOf(founderWallet), decimals)} ABCD (55%)\`);
  console.log(\`ICO:         \${ethers.formatUnits(await token.balanceOf(icoWallet), decimals)} ABCD (20%)\`);
  console.log(\`Marketing:   \${ethers.formatUnits(await token.balanceOf(marketingWallet), decimals)} ABCD (10%)\`);
  console.log(\`Finance:     \${ethers.formatUnits(await token.balanceOf(financeWallet), decimals)} ABCD (9%)\`);
  console.log(\`Advisor:     \${ethers.formatUnits(await token.balanceOf(advisorWallet), decimals)} ABCD (2%)\`);
  console.log(\`Reserve:     \${ethers.formatUnits(await token.balanceOf(reserveWallet), decimals)} ABCD (2%)\`);
  console.log(\`Contingency: \${ethers.formatUnits(await token.balanceOf(contingencyWallet), decimals)} ABCD (2%)\`);

  console.log("\\n==================================================");
  console.log("  Deployment completed successfully!              ");
  console.log("==================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`
  },
  {
    id: 'test',
    name: 'ABCDToken.test.ts',
    path: 'test/ABCDToken.test.ts',
    language: 'typescript',
    description: 'Complete Mocha/Chai unit test suite covering deployment, allocations, roles, mint, burn, pause, and rescue.',
    content: `import { expect } from "chai";
import { ethers } from "hardhat";
import { ABCDToken } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ABCDToken Core Contract Suite", function () {
  let token: ABCDToken;
  let owner: HardhatEthersSigner;
  let founder: HardhatEthersSigner;
  let ico: HardhatEthersSigner;
  let marketing: HardhatEthersSigner;
  let finance: HardhatEthersSigner;
  let advisor: HardhatEthersSigner;
  let reserve: HardhatEthersSigner;
  let contingency: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;

  const MAX_SUPPLY = ethers.parseUnits("1000000000", 18); // 1 Billion ABCD

  beforeEach(async function () {
    [
      owner,
      founder,
      ico,
      marketing,
      finance,
      advisor,
      reserve,
      contingency,
      user1,
      user2,
    ] = await ethers.getSigners();

    const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
    token = await ABCDTokenFactory.deploy(
      founder.address,
      ico.address,
      marketing.address,
      finance.address,
      advisor.address,
      reserve.address,
      contingency.address
    );
    await token.waitForDeployment();
  });

  describe("1. Deployment & Supply Allocation", function () {
    it("should set correct token metadata", async function () {
      expect(await token.name()).to.equal("ABCDeFi Core Token");
      expect(await token.symbol()).to.equal("ABCD");
      expect(await token.decimals()).to.equal(18);
      expect(await token.maxSupply()).to.equal(MAX_SUPPLY);
    });

    it("should mint exactly 1,000,000,000 ABCD across ecosystem wallets", async function () {
      expect(await token.totalSupply()).to.equal(MAX_SUPPLY);

      const founderBal     = await token.balanceOf(founder.address);
      const icoBal         = await token.balanceOf(ico.address);
      const marketingBal   = await token.balanceOf(marketing.address);
      const financeBal     = await token.balanceOf(finance.address);
      const advisorBal     = await token.balanceOf(advisor.address);
      const reserveBal     = await token.balanceOf(reserve.address);
      const contingencyBal = await token.balanceOf(contingency.address);

      expect(founderBal).to.equal(ethers.parseUnits("550000000", 18)); // 55%
      expect(icoBal).to.equal(ethers.parseUnits("200000000", 18));     // 20%
      expect(marketingBal).to.equal(ethers.parseUnits("100000000", 18)); // 10%
      expect(financeBal).to.equal(ethers.parseUnits("90000000", 18));   // 9%
      expect(advisorBal).to.equal(ethers.parseUnits("20000000", 18));   // 2%
      expect(reserveBal).to.equal(ethers.parseUnits("20000000", 18));   // 2%
      expect(contingencyBal).to.equal(ethers.parseUnits("20000000", 18)); // 2%
    });

    it("should default treasury to finance wallet and assign TREASURY_ROLE", async function () {
      expect(await token.treasury()).to.equal(finance.address);
      const TREASURY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURY_ROLE"));
      expect(await token.hasRole(TREASURY_ROLE, finance.address)).to.be.true;
    });

    it("should revert deployment if zero address is passed", async function () {
      const ABCDTokenFactory = await ethers.getContractFactory("ABCDToken");
      await expect(
        ABCDTokenFactory.deploy(
          ethers.ZeroAddress,
          ico.address,
          marketing.address,
          finance.address,
          advisor.address,
          reserve.address,
          contingency.address
        )
      ).to.be.revertedCustomError(token, "InvalidAddress");
    });
  });

  describe("2. Role Controls & Minting Mechanics", function () {
    it("should allow MINTER_ROLE to mint tokens if under MAX_SUPPLY", async function () {
      const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));
      await token.grantRole(BURNER_ROLE, owner.address);
      await token.burnFromTreasury(ethers.parseUnits("1000", 18));

      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      await token.grantRole(MINTER_ROLE, owner.address);

      await expect(token.mint(user1.address, ethers.parseUnits("500", 18)))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, user1.address, ethers.parseUnits("500", 18));

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseUnits("500", 18));
    });

    it("should revert mint if unauthorized account tries to mint", async function () {
      await expect(
        token.connect(user1).mint(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("should revert mint if exceeding MAX_SUPPLY", async function () {
      const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
      await token.grantRole(MINTER_ROLE, owner.address);

      await expect(
        token.mint(user1.address, ethers.parseUnits("1", 18))
      ).to.be.revertedCustomError(token, "MaxSupplyExceeded");
    });
  });

  describe("3. Treasury & Burning Mechanics", function () {
    it("should allow treasury role to burn tokens from treasury wallet", async function () {
      const burnAmount = ethers.parseUnits("5000000", 18);
      const initialFinanceBal = await token.balanceOf(finance.address);

      await expect(token.connect(finance).burnFromTreasury(burnAmount))
        .to.emit(token, "TreasuryBurn")
        .withArgs(finance.address, burnAmount);

      expect(await token.balanceOf(finance.address)).to.equal(initialFinanceBal - burnAmount);
    });

    it("should allow owner to reassign treasury and transfer TREASURY_ROLE", async function () {
      const TREASURY_ROLE = ethers.keccak256(ethers.toUtf8Bytes("TREASURY_ROLE"));

      await expect(token.setTreasury(user2.address))
        .to.emit(token, "TreasuryUpdated")
        .withArgs(finance.address, user2.address);

      expect(await token.treasury()).to.equal(user2.address);
      expect(await token.hasRole(TREASURY_ROLE, user2.address)).to.be.true;
      expect(await token.hasRole(TREASURY_ROLE, finance.address)).to.be.false;
    });
  });

  describe("4. Pausing & Unpausing Transfers", function () {
    it("should revert transfers when paused", async function () {
      const PAUSER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PAUSER_ROLE"));
      await token.grantRole(PAUSER_ROLE, owner.address);

      await token.pause();
      expect(await token.isPaused()).to.be.true;

      await expect(
        token.connect(founder).transfer(user1.address, ethers.parseUnits("100", 18))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");

      await token.unpause();
      expect(await token.isPaused()).to.be.false;

      await expect(
        token.connect(founder).transfer(user1.address, ethers.parseUnits("100", 18))
      ).to.emit(token, "Transfer");
    });
  });

  describe("5. Emergency Rescue Logic", function () {
    it("should rescue accidental ETH sent to contract", async function () {
      await owner.sendTransaction({
        to: await token.getAddress(),
        value: ethers.parseEther("1.0"),
      });

      const initialUserBal = await ethers.provider.getBalance(user1.address);
      await token.rescueETH(user1.address, ethers.parseEther("1.0"));
      const finalUserBal = await ethers.provider.getBalance(user1.address);

      expect(finalUserBal - initialUserBal).to.equal(ethers.parseEther("1.0"));
    });
  });
});`
  }
];
