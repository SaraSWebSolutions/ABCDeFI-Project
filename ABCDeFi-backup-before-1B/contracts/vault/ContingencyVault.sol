// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title ContingencyVault
 * @notice Emergency vault protecting the 2% contingency token allocation and emergency funds.
 *         Requires multisig approval / threshold approvals for emergency withdrawals.
 */
contract ContingencyVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public requiredApprovals = 2;

    struct WithdrawalRequest {
        address recipient;
        uint256 tokenAmount;
        uint256 ethAmount;
        string reason;
        uint256 approvalCount;
        bool executed;
    }

    mapping(bytes32 => WithdrawalRequest) public requests;
    mapping(bytes32 => mapping(address => bool)) public approvals;

    event EmergencyRequestCreated(bytes32 indexed requestId, address indexed recipient, uint256 tokenAmount, uint256 ethAmount);
    event EmergencyRequestApproved(bytes32 indexed requestId, address indexed approver);
    event EmergencyWithdrawExecuted(bytes32 indexed requestId, address indexed recipient, uint256 tokenAmount, uint256 ethAmount);

    constructor(address tokenAddress, uint256 requiredApprovals_) {
        if (tokenAddress == address(0)) revert Errors.InvalidAddress();
        token = IERC20(tokenAddress);
        if (requiredApprovals_ > 0) requiredApprovals = requiredApprovals_;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(Constants.VAULT_ADMIN_ROLE, msg.sender);
    }

    function setRequiredApprovals(uint256 count) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(count > 0, "Invalid count");
        requiredApprovals = count;
    }

    function createEmergencyRequest(
        address recipient,
        uint256 tokenAmount,
        uint256 ethAmount,
        string memory reason
    ) external onlyRole(Constants.VAULT_ADMIN_ROLE) returns (bytes32 requestId) {
        if (recipient == address(0)) revert Errors.InvalidAddress();
        requestId = keccak256(abi.encodePacked(recipient, tokenAmount, ethAmount, reason, block.timestamp));

        requests[requestId] = WithdrawalRequest({
            recipient: recipient,
            tokenAmount: tokenAmount,
            ethAmount: ethAmount,
            reason: reason,
            approvalCount: 0,
            executed: false
        });

        emit EmergencyRequestCreated(requestId, recipient, tokenAmount, ethAmount);
    }

    function approveEmergencyRequest(bytes32 requestId) external onlyRole(Constants.VAULT_ADMIN_ROLE) {
        WithdrawalRequest storage req = requests[requestId];
        require(!req.executed, "Already executed");
        require(!approvals[requestId][msg.sender], "Already approved by caller");

        approvals[requestId][msg.sender] = true;
        req.approvalCount += 1;

        emit EmergencyRequestApproved(requestId, msg.sender);

        if (req.approvalCount >= requiredApprovals) {
            req.executed = true;

            if (req.tokenAmount > 0) {
                token.safeTransfer(req.recipient, req.tokenAmount);
            }
            if (req.ethAmount > 0) {
                (bool success, ) = req.recipient.call{value: req.ethAmount}("");
                require(success, "ETH transfer failed");
            }

            emit EmergencyWithdrawExecuted(requestId, req.recipient, req.tokenAmount, req.ethAmount);
        }
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    receive() external payable {}
}
