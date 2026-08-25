// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEMIManager
 * @notice Minimal interface used by the P2P marketplace to create an EMI schedule.
 */
interface IEMIManager {
    function createSchedule(
        uint256 loanId,
        uint256 totalInstallments,
        uint256 emiAmount,
        uint256 totalRepayment,
        uint256 startTimestamp
    ) external;

    function isDefaulted(uint256 loanId) external view returns (bool);
    function markDefaulted(uint256 loanId) external;
}
