// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Simple bonus engine for ICO purchases
contract BonusEngine is Ownable {
    constructor() Ownable(msg.sender) {}
    // types of bonuses
    mapping(bytes32 => uint256) public bonusPercents; // key => percent

    event BonusSet(bytes32 key, uint256 percent);

    function setBonus(bytes32 key, uint256 percent) external onlyOwner {
        bonusPercents[key] = percent;
        emit BonusSet(key, percent);
    }

    function calcBonus(bytes32 key, uint256 baseAmount) external view returns (uint256) {
        uint256 p = bonusPercents[key];
        return (baseAmount * p) / 100;
    }
}
