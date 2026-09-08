// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "../lending/v2/LendingPoolV2.sol";

/// @dev Test-only receiver that attempts to reenter collateral withdrawal on receiving ETH.
contract ReentrantBorrowerV2 is IERC721Receiver {
    LendingPoolV2 public immutable pool;
    IERC20 public immutable token;
    uint256 public targetLoanId;
    bool public attackEnabled;
    bool public reentryFailed;

    constructor(address pool_, address token_) { pool = LendingPoolV2(pool_); token = IERC20(token_); }

    function open(uint128 principal, uint48 term, string calldata uri, bytes32 metadataHash) external payable returns (uint256) {
        return pool.openLoan{value: msg.value}(principal, term, uri, metadataHash);
    }
    function repay(uint256 loanId, uint256 amount) external {
        token.approve(address(pool), amount); pool.repay(loanId, amount);
    }
    function repayAll(uint256 loanId, uint256 approvalAmount) external {
        token.approve(address(pool), approvalAmount); pool.repayAll(loanId);
    }
    function withdrawWithReentry(uint256 loanId) external { targetLoanId = loanId; attackEnabled = true; pool.withdrawSettledCollateral(loanId); attackEnabled = false; }
    receive() external payable {
        if (attackEnabled) {
            try pool.withdrawSettledCollateral(targetLoanId) { } catch { reentryFailed = true; }
        }
    }
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) { return IERC721Receiver.onERC721Received.selector; }
}
