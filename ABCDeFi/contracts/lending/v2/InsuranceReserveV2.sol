// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoanManagerV2.sol";

/// @notice ABCD insurance reserve used only to make approved V2 liquidation shortfalls explicit.
contract InsuranceReserveV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant RESERVE_FUNDER_ROLE = keccak256("RESERVE_FUNDER_ROLE");
    bytes32 public constant RESERVE_OPERATOR_ROLE = keccak256("RESERVE_OPERATOR_ROLE");

    IERC20 public immutable asset;
    LoanManagerV2 public immutable loanManager;
    mapping(uint256 => uint256) public reserveUsedByLoan;
    mapping(uint256 => bool) public reserveSettlementProcessed;

    event ReserveFunded(address indexed funder, uint256 amount);
    event ReserveUsed(uint256 indexed loanId, address indexed recipient, uint256 requested, uint256 paid);
    /// @notice Supplementary accounting evidence. The original funding/payout
    /// events remain stable for existing indexers.
    event ReserveBalanceUpdated(uint256 indexed loanId, address indexed recipient, uint256 paid, uint256 balanceAfter);

    constructor(address admin, address asset_, address manager_) {
        require(admin != address(0) && asset_ != address(0) && manager_ != address(0), "invalid address");
        asset = IERC20(asset_);
        loanManager = LoanManagerV2(manager_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RESERVE_FUNDER_ROLE, admin);
        _grantRole(RESERVE_OPERATOR_ROLE, admin);
    }

    function availableBalance() external view returns (uint256) { return asset.balanceOf(address(this)); }

    function fund(uint256 amount) external onlyRole(RESERVE_FUNDER_ROLE) whenNotPaused nonReentrant {
        require(amount != 0, "zero amount");
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
        emit ReserveBalanceUpdated(0, address(this), 0, asset.balanceOf(address(this)));
    }

    /// @dev Pays no more than the funded reserve. The unpaid amount remains explicit bad debt.
    function cover(uint256 loanId, address recipient, uint256 requested)
        external
        onlyRole(RESERVE_OPERATOR_ROLE)
        nonReentrant
        returns (uint256 paid)
    {
        require(loanId != 0 && recipient != address(0) && requested != 0, "invalid settlement");
        require(!reserveSettlementProcessed[loanId], "reserve already settled");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.borrower != address(0), "missing loan");
        // A reserve payment is a liquidation/default settlement operation,
        // never a discretionary payment on a healthy or merely overdue loan.
        require(
            loan.state == LoanManagerV2.State.MARGIN_CALL || loan.state == LoanManagerV2.State.DEFAULTED,
            "loan not reserve eligible"
        );
        // The reserve may only reimburse the loan's recorded lender. This
        // keeps direct shortfalls in the direct pool and makes future P2P
        // reserve use pay its recorded lender, never an operator-selected wallet.
        require(recipient == loan.lender, "invalid reserve recipient");
        require(requested <= loanManager.previewOutstanding(loanId), "amount exceeds debt");
        reserveSettlementProcessed[loanId] = true;
        paid = requested < asset.balanceOf(address(this)) ? requested : asset.balanceOf(address(this));
        if (paid != 0) {
            reserveUsedByLoan[loanId] += paid;
            asset.safeTransfer(recipient, paid);
        }
        emit ReserveUsed(loanId, recipient, requested, paid);
        emit ReserveBalanceUpdated(loanId, recipient, paid, asset.balanceOf(address(this)));
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
