// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal custody interface for the owner-approved 1Q seven-allocation token.
/// @dev This is deliberately separate from the historical IABCDToken interface.
interface IABCDTokenV2 is IERC20 {
    function icoWallet() external view returns (address);
    function marketingWallet() external view returns (address);
    function financeResourceWallet() external view returns (address);
    function reserveWallet() external view returns (address);
    function treasury() external view returns (address);
}
