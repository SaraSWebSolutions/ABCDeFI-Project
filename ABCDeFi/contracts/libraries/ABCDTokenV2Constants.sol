// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/** Owner-approved 1Q supply and seven-allocation model. */
library ABCDTokenV2Constants {
    uint256 internal constant BPS_DENOMINATOR = 10_000;
    uint256 internal constant MAX_SUPPLY = 1_000_000_000_000_000 * 10 ** 18;
    uint256 internal constant ICO_BPS = 2_000;
    uint256 internal constant FOUNDER_BPS = 5_500;
    uint256 internal constant MARKETING_BPS = 1_000;
    uint256 internal constant ADVISORS_BPS = 200;
    uint256 internal constant FINANCE_RESOURCE_BPS = 900;
    uint256 internal constant CONTINGENCY_BPS = 200;
    uint256 internal constant RESERVE_BPS = 200;
}
