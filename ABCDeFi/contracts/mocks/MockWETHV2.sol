// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local-test-only wrapped native token. Never a production WETH address.
contract MockWETHV2 is ERC20 {
    constructor() ERC20("Mock Wrapped ETH", "mWETH") { }
    function deposit() external payable { _mint(msg.sender, msg.value); }
    function withdraw(uint256 amount) external { _burn(msg.sender, amount); payable(msg.sender).transfer(amount); }
    receive() external payable { _mint(msg.sender, msg.value); }
}
