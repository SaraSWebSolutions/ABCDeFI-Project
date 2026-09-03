// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IABCDToken
 * @notice External interface for the ABCDToken core smart contract used by
 *         ABCDeFi ecosystem contracts.
 */
interface IABCDToken is IERC20 {
    // --- Events ---

    event TreasuryUpdated(
        address indexed previousTreasury,
        address indexed newTreasury
    );

    event EcosystemWalletsUpdated(
        address infrastructureWallet,
        address liquidityWallet,
        address marketingWallet,
        address contractsWallet,
        address communityWallet,
        address educationWallet,
        address contingencyWallet,
        address reserveWallet
    );

    event TokensRescued(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    event NativeRescued(
        address indexed to,
        uint256 amount
    );

    event TreasuryBurn(
        address indexed treasury,
        uint256 amount
    );

    // --- Core Mechanics ---

    function mint(
        address to,
        uint256 amount
    ) external;

    function burnFromTreasury(
        uint256 amount
    ) external;

    function pause() external;

    function unpause() external;

    // --- Admin Operations ---

    function setTreasury(
        address newTreasury
    ) external;

    /**
     * @notice Updates ecosystem wallet record references.
     * @dev Does not move existing token balances.
     */
    function updateWallets(
        address infrastructureWallet_,
        address liquidityWallet_,
        address marketingWallet_,
        address contractsWallet_,
        address communityWallet_,
        address educationWallet_,
        address contingencyWallet_,
        address reserveWallet_
    ) external;

    function rescueERC20(
        address token,
        address to,
        uint256 amount
    ) external;

    function rescueETH(
        address payable to,
        uint256 amount
    ) external;

    // --- View Functions ---

    function treasury()
        external
        view
        returns (address);

    function isPaused()
        external
        view
        returns (bool);

    function maxSupply()
        external
        view
        returns (uint256);

    // --- Ecosystem Wallet Getters ---

    function infrastructureWallet()
        external
        view
        returns (address);

    function liquidityWallet()
        external
        view
        returns (address);

    function marketingWallet()
        external
        view
        returns (address);

    function contractsWallet()
        external
        view
        returns (address);

    function communityWallet()
        external
        view
        returns (address);

    function educationWallet()
        external
        view
        returns (address);

    function contingencyWallet()
        external
        view
        returns (address);

    function reserveWallet()
        external
        view
        returns (address);
}