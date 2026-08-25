// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../libraries/Validation.sol";

contract ValidationHarness {
    function testValidateAddress(address addr) external pure {
        Validation.validateAddress(addr);
    }

    function testValidateAmount(uint256 amount) external pure {
        Validation.validateAmount(amount);
    }

    function testValidatePercentage(uint256 bps, uint256 maxBps) external pure {
        Validation.validatePercentage(bps, maxBps);
    }

    function testValidateDeadline(uint256 deadline) external view {
        Validation.validateDeadline(deadline);
    }
}
