// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    constructor() Ownable(msg.sender) {}
    // Simple treasury to distribute collected funds to predefined addresses
    struct Allocation { address to; uint256 percent; }
    Allocation[] public allocations;

    event AllocationSet(address to, uint256 percent);

    receive() external payable {}

    function setAllocations(Allocation[] calldata a) external onlyOwner {
        delete allocations;
        uint256 sum;
        for (uint256 i = 0; i < a.length; i++) {
            allocations.push(a[i]);
            sum += a[i].percent;
            emit AllocationSet(a[i].to, a[i].percent);
        }
        require(sum == 100, "must sum to 100");
    }

    function distributeETH() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "zero balance");
        for (uint256 i = 0; i < allocations.length; i++) {
            (bool ok, ) = allocations[i].to.call{ value: (bal * allocations[i].percent) / 100 }("");
            require(ok, "transfer failed");
        }
    }

    function distributeToken(address tokenAddr) external onlyOwner {
        uint256 bal = IERC20(tokenAddr).balanceOf(address(this));
        require(bal > 0, "zero balance");
        for (uint256 i = 0; i < allocations.length; i++) {
            IERC20(tokenAddr).transfer(allocations[i].to, (bal * allocations[i].percent) / 100);
        }
    }
}
