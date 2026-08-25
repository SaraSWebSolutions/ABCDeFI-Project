// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VestingVault is Ownable {
    IERC20 public token;

    struct Schedule {
        uint256 total;
        uint256 released;
        uint256 start;
        uint256 cliff;
        uint256 duration;
    }

    mapping(address => Schedule) public schedules;

    event Locked(address indexed who, uint256 amount, uint256 start, uint256 cliff, uint256 duration);
    event Claimed(address indexed who, uint256 amount);

    constructor(address tokenAddr) Ownable(msg.sender) {
        token = IERC20(tokenAddr);
    }

    function lock(address who, uint256 amount, uint256 start, uint256 cliff, uint256 duration) external onlyOwner {
        require(who != address(0), "zero");
        require(amount > 0, "zero amount");
        schedules[who] = Schedule(amount, 0, start, cliff, duration);
        emit Locked(who, amount, start, cliff, duration);
    }

    function claim() external {
        Schedule storage s = schedules[msg.sender];
        require(s.total > 0, "no schedule");

        uint256 vested = _vestedAmount(s);
        uint256 claimable = vested - s.released;
        require(claimable > 0, "nothing to claim");

        s.released += claimable;
        token.transfer(msg.sender, claimable);
        emit Claimed(msg.sender, claimable);
    }

    function _vestedAmount(Schedule memory s) internal view returns (uint256) {
        if (block.timestamp < s.start + s.cliff) return 0;
        if (block.timestamp >= s.start + s.duration) return s.total;
        uint256 elapsed = block.timestamp - s.start;
        return (s.total * elapsed) / s.duration;
    }

    function recover(address to, uint256 amount) external onlyOwner {
        token.transfer(to, amount);
    }
}
