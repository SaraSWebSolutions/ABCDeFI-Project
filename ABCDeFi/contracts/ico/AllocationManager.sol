// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

contract AllocationManager is AccessControl, Pausable {
    struct Allocation {
        bytes32 key;
        string name;
        address wallet;
        uint256 bps;
        uint256 amount;
        bool frozen;
    }

    bytes32 public constant INFRASTRUCTURE_KEY =
        keccak256("INFRASTRUCTURE");

    bytes32 public constant LIQUIDITY_KEY =
        keccak256("LIQUIDITY");

    bytes32 public constant MARKETING_KEY =
        keccak256("MARKETING");

    bytes32 public constant CONTRACTS_KEY =
        keccak256("CONTRACTS");

    bytes32 public constant COMMUNITY_KEY =
        keccak256("COMMUNITY");

    bytes32 public constant EDUCATION_KEY =
        keccak256("EDUCATION");

    bytes32 public constant CONTINGENCY_KEY =
        keccak256("CONTINGENCY");

    bytes32 public constant RESERVE_KEY =
        keccak256("RESERVE");

    mapping(bytes32 => Allocation) private _allocations;
    bytes32[] private _allocationKeys;

    event AllocationCreated(
        bytes32 indexed key,
        string name,
        address indexed wallet,
        uint256 bps,
        uint256 amount
    );

    event AllocationUpdated(
        bytes32 indexed key,
        address indexed oldWallet,
        address indexed newWallet,
        uint256 oldAmount,
        uint256 newAmount
    );

    event AllocationFrozen(bytes32 indexed key);
    event AllocationUnfrozen(bytes32 indexed key);

    constructor(
        address infrastructure,
        address liquidity,
        address marketing,
        address contractsWallet,
        address community,
        address education,
        address contingency,
        address reserve
    ) {
        if (
            infrastructure == address(0) ||
            liquidity == address(0) ||
            marketing == address(0) ||
            contractsWallet == address(0) ||
            community == address(0) ||
            education == address(0) ||
            contingency == address(0) ||
            reserve == address(0)
        ) {
            revert Errors.InvalidAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _createAllocation(
            "INFRASTRUCTURE",
            INFRASTRUCTURE_KEY,
            infrastructure,
            Constants.INFRASTRUCTURE_BPS
        );

        _createAllocation(
            "LIQUIDITY",
            LIQUIDITY_KEY,
            liquidity,
            Constants.LIQUIDITY_BPS
        );

        _createAllocation(
            "MARKETING",
            MARKETING_KEY,
            marketing,
            Constants.MARKETING_BPS
        );

        _createAllocation(
            "CONTRACTS",
            CONTRACTS_KEY,
            contractsWallet,
            Constants.CONTRACTS_BPS
        );

        _createAllocation(
            "COMMUNITY",
            COMMUNITY_KEY,
            community,
            Constants.COMMUNITY_BPS
        );

        _createAllocation(
            "EDUCATION",
            EDUCATION_KEY,
            education,
            Constants.EDUCATION_BPS
        );

        _createAllocation(
            "CONTINGENCY",
            CONTINGENCY_KEY,
            contingency,
            Constants.CONTINGENCY_BPS
        );

        _createAllocation(
            "RESERVE",
            RESERVE_KEY,
            reserve,
            Constants.RESERVE_BPS
        );
    }

    function _createAllocation(
        string memory name,
        bytes32 key,
        address wallet,
        uint256 bps
    ) internal {
        if (wallet == address(0)) {
            revert Errors.InvalidAddress();
        }

        uint256 amount =
            (Constants.MAX_SUPPLY * bps) /
            Constants.BPS_DENOMINATOR;

        _allocations[key] = Allocation({
            key: key,
            name: name,
            wallet: wallet,
            bps: bps,
            amount: amount,
            frozen: false
        });

        _allocationKeys.push(key);

        emit AllocationCreated(
            key,
            name,
            wallet,
            bps,
            amount
        );
    }

    function getAllocation(bytes32 key)
        external
        view
        returns (Allocation memory)
    {
        return _allocations[key];
    }

    function getAllocationKeys()
        external
        view
        returns (bytes32[] memory)
    {
        return _allocationKeys;
    }

    function allocationCount()
        external
        view
        returns (uint256)
    {
        return _allocationKeys.length;
    }

    function updateAllocation(
        bytes32 key,
        address newWallet
    )
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (newWallet == address(0)) {
            revert Errors.InvalidAddress();
        }

        Allocation storage allocation = _allocations[key];

        if (allocation.wallet == address(0)) {
            revert Errors.InvalidAddress();
        }

        if (allocation.frozen) {
            revert Errors.UnauthorizedAccount(
                msg.sender,
                DEFAULT_ADMIN_ROLE
            );
        }

        address oldWallet = allocation.wallet;
        uint256 oldAmount = allocation.amount;

        allocation.wallet = newWallet;

        emit AllocationUpdated(
            key,
            oldWallet,
            newWallet,
            oldAmount,
            allocation.amount
        );
    }

    function freezeAllocation(bytes32 key)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Allocation storage allocation = _allocations[key];

        if (allocation.wallet == address(0)) {
            revert Errors.InvalidAddress();
        }

        allocation.frozen = true;

        emit AllocationFrozen(key);
    }

    function unfreezeAllocation(bytes32 key)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        Allocation storage allocation = _allocations[key];

        if (allocation.wallet == address(0)) {
            revert Errors.InvalidAddress();
        }

        allocation.frozen = false;

        emit AllocationUnfrozen(key);
    }

    function pause()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _pause();
    }

    function unpause()
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _unpause();
    }
}