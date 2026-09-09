// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasuryWithdrawer {
    function withdrawETH(address payable recipient, uint256 amount) external;
}

/// @dev Test-only recipient that attempts one nested Treasury withdrawal when paid.
contract ReentrantTreasuryRecipient {
    ITreasuryWithdrawer public immutable treasury;
    uint256 public attackAmount;
    bool public attemptedReentry;
    bool public reentrySucceeded;

    constructor(address treasuryAddress) {
        treasury = ITreasuryWithdrawer(treasuryAddress);
    }

    function beginAttack(uint256 amount) external {
        attackAmount = amount;
        treasury.withdrawETH(payable(address(this)), amount);
    }

    receive() external payable {
        if (!attemptedReentry) {
            attemptedReentry = true;
            (bool success, ) = address(treasury).call(
                abi.encodeCall(ITreasuryWithdrawer.withdrawETH, (payable(address(this)), attackAmount))
            );
            reentrySucceeded = success;
        }
    }
}
