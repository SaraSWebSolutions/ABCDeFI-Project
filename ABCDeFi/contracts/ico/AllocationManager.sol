// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title AllocationManager
 * @notice Manages ecosystem allocations, wallet assignments, allocation history, and freeze controls for ABCDeFi.
 */
contract AllocationManager is AccessControl, Pausable {

    struct AllocationInfo {
        string name;
        address wallet;
        uint256 bps;
        bool isFrozen;
    }

    bytes32 public constant ALLOCATION_ADMIN_ROLE = keccak256("ALLOCATION_ADMIN_ROLE");

    struct HistoryRecord {
        bytes32 key;
        address fromWallet;
        address to;
        uint256 amount;
        string reason;
        uint256 timestamp;
    }

    mapping(bytes32 => AllocationInfo) public allocations;
    bytes32[] public allocationKeys;
    HistoryRecord[] public history;

    event AllocationUpdated(bytes32 indexed key, address indexed oldWallet, address indexed newWallet);
    event AllocationFrozen(bytes32 indexed key);
    event AllocationUnfrozen(bytes32 indexed key);
    event AllocationTransferRecorded(bytes32 indexed key, address indexed fromWallet, address indexed to, uint256 amount, string reason);

    constructor(
        address founder,
        address ico,
        address marketing,
        address advisor,
        address finance,
        address reserve,
        address contingency
    ) {
        if (
            founder == address(0) || ico == address(0) || marketing == address(0) ||
            advisor == address(0) || finance == address(0) || reserve == address(0) ||
            contingency == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ALLOCATION_ADMIN_ROLE, msg.sender);

        _createAllocation("FOUNDER", keccak256("FOUNDER"), founder, Constants.FOUNDER_BPS);
        _createAllocation("ICO", keccak256("ICO"), ico, Constants.ICO_BPS);
        _createAllocation("MARKETING", keccak256("MARKETING"), marketing, Constants.MARKETING_BPS);
        _createAllocation("ADVISOR", keccak256("ADVISOR"), advisor, Constants.ADVISOR_BPS);
        _createAllocation("FINANCE", keccak256("FINANCE"), finance, Constants.FINANCE_BPS);
        _createAllocation("RESERVE", keccak256("RESERVE"), reserve, Constants.RESERVE_BPS);
        _createAllocation("CONTINGENCY", keccak256("CONTINGENCY"), contingency, Constants.CONTINGENCY_BPS);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function _createAllocation(string memory name, bytes32 key, address wallet, uint256 bps) internal {
        allocations[key] = AllocationInfo({
            name: name,
            wallet: wallet,
            bps: bps,
            isFrozen: false
        });
        allocationKeys.push(key);
    }

    function recordTransfer(bytes32 key, address to, uint256 amount, string memory reason) external onlyRole(ALLOCATION_ADMIN_ROLE) whenNotPaused {
        AllocationInfo memory alloc = allocations[key];
        require(alloc.wallet != address(0), "Invalid allocation key");
        require(!alloc.isFrozen, "Allocation is frozen");

        history.push(HistoryRecord({
            key: key,
            fromWallet: alloc.wallet,
            to: to,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp
        }));

        emit AllocationTransferRecorded(key, alloc.wallet, to, amount, reason);
    }

    function updateWallet(bytes32 key, address newWallet) external onlyRole(ALLOCATION_ADMIN_ROLE) whenNotPaused {
        if (newWallet == address(0)) revert Errors.InvalidAddress();
        AllocationInfo storage alloc = allocations[key];
        if (alloc.wallet == address(0)) revert Errors.InvalidAddress();
        if (alloc.isFrozen) revert Errors.UnauthorizedAccount(msg.sender, ALLOCATION_ADMIN_ROLE);

        address oldWallet = alloc.wallet;
        alloc.wallet = newWallet;

        emit AllocationUpdated(key, oldWallet, newWallet);
    }

    function freezeAllocation(bytes32 key) external onlyRole(ALLOCATION_ADMIN_ROLE) whenNotPaused {
        allocations[key].isFrozen = true;
        emit AllocationFrozen(key);
    }

    function unfreezeAllocation(bytes32 key) external onlyRole(ALLOCATION_ADMIN_ROLE) whenNotPaused {
        allocations[key].isFrozen = false;
        emit AllocationUnfrozen(key);
    }

    function getAllocation(bytes32 key) external view returns (string memory name, address wallet, uint256 bps, bool frozen) {
        AllocationInfo memory alloc = allocations[key];
        return (alloc.name, alloc.wallet, alloc.bps, alloc.isFrozen);
    }

    function getHistory() external view returns (HistoryRecord[] memory) {
        return history;
    }

    function getAllKeys() external view returns (bytes32[] memory) {
        return allocationKeys;
    }
}
