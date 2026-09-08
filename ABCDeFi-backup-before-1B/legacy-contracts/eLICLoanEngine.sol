// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../oracle/IPriceOracle.sol";
import "./IInterestEngine.sol";
import "./CollateralVault.sol";
import "./XTokenManager.sol";

/**
 * @title eLICLoanEngine
 * @dev Core loan lifecycle contract for the ABCDeFi platform.
 *      Supports creation, approval, funding, cancellation and closure of loans.
 */
contract eLICLoanEngine is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant LOAN_OPERATOR_ROLE = keccak256("LOAN_OPERATOR_ROLE");

    // Loan status enumeration
    enum LoanStatus { OPEN, APPROVED, FUNDED, ACTIVE, REPAID, LIQUIDATED, CANCELLED }

    struct Loan {
        uint256 id;
        address borrower;
        address lender;
        uint256 principal; // in wei of loan token (e.g., USDC) – for simplicity using native ETH
        uint256 collateral; // amount of ETH locked
        uint256 interestRateBps; // basis points (e.g., 500 = 5%)
        uint256 emi; // amount per month (wei)
        uint256 durationMonths;
        uint256 startTimestamp;
        LoanStatus status;
    }

    uint256 public nextLoanId;
    mapping(uint256 => Loan) public loans;

    // External modules
    IInterestEngine public interestEngine;
    CollateralVault public collateralVault;
    XTokenManager public xTokenManager;
    IERC20 public loanToken; // could be an ERC20 stablecoin; using ETH for demo

    // Events
    event LoanCreated(uint256 indexed loanId, address borrower, uint256 principal, uint256 collateral);
    event LoanApproved(uint256 indexed loanId);
    event LoanFunded(uint256 indexed loanId, address lender);
    event LoanCancelled(uint256 indexed loanId);
    event LoanClosed(uint256 indexed loanId);
    event CollateralLocked(uint256 indexed loanId, uint256 amount);
    event CollateralReleased(uint256 indexed loanId, address to);

    constructor(
        address _interestEngine,
        address _collateralVault,
        address _xTokenManager,
        address _loanToken
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        interestEngine = IInterestEngine(_interestEngine);
        collateralVault = CollateralVault(_collateralVault);
        xTokenManager = XTokenManager(_xTokenManager);
        loanToken = IERC20(_loanToken);
    }

    // --- Loan lifecycle functions -------------------------------------------------

    /**
     * @notice Borrower creates a loan request.
     * @param principal Amount of loan token requested (wei).
     * @param durationMonths Duration of loan in months.
     * @param purpose Text description (not stored on-chain, just an event param).
     */
    function createLoan(
        uint256 principal,
        uint256 durationMonths,
        string calldata purpose
    ) external payable whenNotPaused nonReentrant returns (uint256 loanId) {
        require(principal > 0, "Principal must be >0");
        require(durationMonths > 0, "Duration must be >0");
        // Collateral is sent as ETH in msg.value
        require(msg.value > 0, "Collateral ETH required");

        // Compute LTV and interest using InterestEngine which pulls price via OracleManager
        (uint256 ltv, uint256 rateBps) = interestEngine.calculateLTVAndRate(principal, msg.value);
        // Disallow loans with LTV > 85% as per whitepaper
        require(ltv <= 85, "LTV too high – manual review required");

        uint256 emi = interestEngine.calculateEMI(principal, rateBps, durationMonths);

        loanId = nextLoanId++;
        loans[loanId] = Loan({
            id: loanId,
            borrower: msg.sender,
            lender: address(0),
            principal: principal,
            collateral: msg.value,
            interestRateBps: rateBps,
            emi: emi,
            durationMonths: durationMonths,
            startTimestamp: 0,
            status: LoanStatus.OPEN
        });

        // Lock collateral in vault (transfer ETH)
        collateralVault.lockCollateral{value: msg.value}(loanId, msg.sender);
        emit CollateralLocked(loanId, msg.value);
        emit LoanCreated(loanId, msg.sender, principal, msg.value);
        // Mint X tokens to borrower based on loan value (simple 1:1 for demo)
        xTokenManager.mintXTokens(msg.sender, principal);
    }

    /**
     * @notice Admin approves a loan after off‑chain checks.
     */
    function approveLoan(uint256 loanId) external onlyRole(ADMIN_ROLE) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.OPEN, "Loan not open");
        loan.status = LoanStatus.APPROVED;
        emit LoanApproved(loanId);
    }

    /**
     * @notice Lender funds an approved loan.
     * @dev For simplicity the loan token is native ETH transferred with the call.
     */
    function fundLoan(uint256 loanId) external payable whenNotPaused nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.APPROVED, "Loan not approved");
        require(msg.value == loan.principal, "Incorrect principal amount");
        loan.lender = msg.sender;
        loan.startTimestamp = block.timestamp;
        loan.status = LoanStatus.ACTIVE;
        // Transfer principal to borrower
        payable(loan.borrower).transfer(msg.value);
        emit LoanFunded(loanId, msg.sender);
    }

    /**
     * @notice Borrower (or admin) can cancel an OPEN loan and retrieve collateral.
     */
    function cancelLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.OPEN, "Only open loans can be cancelled");
        require(msg.sender == loan.borrower || hasRole(ADMIN_ROLE, msg.sender), "Not authorized");
        loan.status = LoanStatus.CANCELLED;
        // Release collateral back to borrower
        collateralVault.releaseCollateral(loanId, loan.borrower);
        emit LoanCancelled(loanId);
        emit CollateralReleased(loanId, loan.borrower);
    }

    /**
     * @notice Called when loan is fully repaid (EMI schedule is out of scope for now).
     *         Releases collateral and mints a Loan NFT (not implemented here).
     */
    function closeLoan(uint256 loanId) external onlyRole(LOAN_OPERATOR_ROLE) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        // In a full implementation we would verify all EMIs paid.
        loan.status = LoanStatus.REPAID;
        // Release collateral to borrower
        collateralVault.releaseCollateral(loanId, loan.borrower);
        emit LoanClosed(loanId);
        emit CollateralReleased(loanId, loan.borrower);
    }

    /**
     * @notice View loan details.
     */
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    // --- Admin functions ----------------------------------------------------------

    function setInterestEngine(address _engine) external onlyRole(ADMIN_ROLE) {
        interestEngine = IInterestEngine(_engine);
    }

    function setCollateralVault(address _vault) external onlyRole(ADMIN_ROLE) {
        collateralVault = CollateralVault(_vault);
    }

    function setXTokenManager(address _manager) external onlyRole(ADMIN_ROLE) {
        xTokenManager = XTokenManager(_manager);
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
