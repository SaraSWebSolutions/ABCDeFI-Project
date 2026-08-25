// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";

/**
 * @title CommissionDistributor
 * @notice Automated 10-way loan interest commission distribution smart contract for ABCDeFi Legion Franchise system.
 *         Distributes generated loan interest to territory franchise owners according to the whitepaper rules.
 */
contract CommissionDistributor is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable abcdToken;
    address public platformTreasury;

    bytes32 public constant DISTRIBUTOR_OPERATOR_ROLE = keccak256("DISTRIBUTOR_OPERATOR_ROLE");

    // Commission Rates in Basis Points (1 Bps = 0.01%)
    uint256 public constant LOCALITY_COMMISSION_BPS = 9;   // 0.09%
    uint256 public constant AREA_COMMISSION_BPS = 8;       // 0.08%
    uint256 public constant PINCODE_COMMISSION_BPS = 7;    // 0.07%
    uint256 public constant DISTRICT_COMMISSION_BPS = 6;   // 0.06%
    uint256 public constant ZONE_COMMISSION_BPS = 5;       // 0.05%
    uint256 public constant STATE_COMMISSION_BPS = 4;      // 0.04%
    uint256 public constant NATIONAL_COMMISSION_BPS = 3;   // 0.03%
    uint256 public constant CONTINENTAL_COMMISSION_BPS = 2;// 0.02%
    uint256 public constant AGGREGATOR_COMMISSION_BPS = 10;// 0.10%
    uint256 public constant PLATFORM_COMMISSION_BPS = 46;  // 0.46%

    uint256 public constant BPS_DENOMINATOR = 10000;

    struct FranchiseHierarchy {
        address localityOwner;
        address areaOwner;
        address pincodeOwner;
        address districtOwner;
        address zoneOwner;
        address stateOwner;
        address nationalOwner;
        address continentalOwner;
        address aggregator;
    }

    // Cumulative earnings tracking
    mapping(address => uint256) public totalCommissionEarned;
    uint256 public totalPlatformCommissionEarned;

    event CommissionDistributed(
        uint256 indexed loanId,
        uint256 totalInterestAmount,
        uint256 totalDistributed
    );
    event TreasuryUpdated(address indexed newTreasury);

    constructor(address admin, address _abcdToken, address _platformTreasury) {
        if (admin == address(0) || _abcdToken == address(0) || _platformTreasury == address(0)) {
            revert Errors.InvalidAddress();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(DISTRIBUTOR_OPERATOR_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        abcdToken = IERC20(_abcdToken);
        platformTreasury = _platformTreasury;
    }

    /**
     * @notice Distribute loan interest commission across all 9 franchise tiers, aggregator, and platform treasury.
     */
    function distributeCommission(
        uint256 loanId,
        uint256 interestAmount,
        FranchiseHierarchy calldata hierarchy
    ) external onlyRole(DISTRIBUTOR_OPERATOR_ROLE) whenNotPaused nonReentrant {
        if (interestAmount == 0) revert Errors.ZeroAmount();

        uint256 totalPayout = 0;

        totalPayout += _payShare(hierarchy.localityOwner, (interestAmount * LOCALITY_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.areaOwner, (interestAmount * AREA_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.pincodeOwner, (interestAmount * PINCODE_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.districtOwner, (interestAmount * DISTRICT_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.zoneOwner, (interestAmount * ZONE_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.stateOwner, (interestAmount * STATE_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.nationalOwner, (interestAmount * NATIONAL_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.continentalOwner, (interestAmount * CONTINENTAL_COMMISSION_BPS) / BPS_DENOMINATOR);
        totalPayout += _payShare(hierarchy.aggregator, (interestAmount * AGGREGATOR_COMMISSION_BPS) / BPS_DENOMINATOR);

        // Platform Treasury Share (0.46%)
        uint256 platformShare = (interestAmount * PLATFORM_COMMISSION_BPS) / BPS_DENOMINATOR;
        if (platformShare > 0) {
            abcdToken.safeTransferFrom(msg.sender, platformTreasury, platformShare);
            totalPlatformCommissionEarned += platformShare;
            totalPayout += platformShare;
        }

        emit CommissionDistributed(loanId, interestAmount, totalPayout);
    }

    function _payShare(address recipient, uint256 amount) private returns (uint256) {
        if (recipient != address(0) && amount > 0) {
            abcdToken.safeTransferFrom(msg.sender, recipient, amount);
            totalCommissionEarned[recipient] += amount;
            return amount;
        }
        return 0;
    }

    function setPlatformTreasury(address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newTreasury == address(0)) revert Errors.InvalidAddress();
        platformTreasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }
}
