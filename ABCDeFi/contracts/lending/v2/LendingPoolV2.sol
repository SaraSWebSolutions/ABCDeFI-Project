// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LoanManagerV2.sol";
import "./CollateralVaultV2.sol";
import "./OracleAdapterV2.sol";
import "./LendingReferralManagerV2.sol";
import "../../nft/LoanNFTV2.sol";

/// @notice Isolated direct-lending V2 pool. V1 pool accounting and economics are never reused here.
contract LendingPoolV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_INITIAL_LTV_BPS = 5_000;
    uint256 private constant BPS = 10_000;
    address public constant ETH_ASSET = address(1);

    bytes32 public constant LIQUIDITY_MANAGER_ROLE = keccak256("LIQUIDITY_MANAGER_ROLE");
    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    OracleAdapterV2 public immutable oracle;
    LoanNFTV2 public immutable loanNFT;
    LendingReferralManagerV2 public immutable lendingReferralManager;
    uint256 public liquidity;
    uint256 public nextCollateralDepositId = 1;
    struct PendingCollateral { address borrower; uint128 amount; bool active; }
    mapping(uint256 => PendingCollateral) public pendingCollateral;

    event LiquidityFunded(address indexed funder, uint256 amount);
    event CollateralDepositCreated(uint256 indexed depositId, address indexed borrower, uint256 collateralETH);
    event PendingCollateralWithdrawn(uint256 indexed depositId, address indexed borrower, uint256 collateralETH);
    // Completion certificates are deliberately not prepared at origination.
    // The three role-specific provenance records are validated and minted only
    // in the atomic terminal-repayment path below.
    event DirectLoanOpened(uint256 indexed loanId, uint256 indexed depositId, address indexed borrower, uint256 principal, uint256 collateralETH, uint48 term, uint48 maturity);
    event DirectLoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 fee, uint256 interest, uint256 principal);
    event DirectLoanCollateralToppedUp(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 totalCollateral);
    event SettledCollateralWithdrawn(uint256 indexed loanId, address indexed borrower, uint256 amount);

    constructor(address admin, address abcd_, address manager_, address vault_, address oracle_, address loanNFT_, address lendingReferralManager_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && oracle_ != address(0) && loanNFT_ != address(0) && lendingReferralManager_ != address(0), "invalid address");
        abcd = IERC20(abcd_); loanManager = LoanManagerV2(manager_); collateralVault = CollateralVaultV2(vault_); oracle = OracleAdapterV2(oracle_); loanNFT = LoanNFTV2(loanNFT_); lendingReferralManager = LendingReferralManagerV2(lendingReferralManager_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(LIQUIDITY_MANAGER_ROLE, admin);
    }

    function fundLiquidity(uint256 amount) external onlyRole(LIQUIDITY_MANAGER_ROLE) whenNotPaused nonReentrant {
        require(amount != 0, "zero amount"); abcd.safeTransferFrom(msg.sender, address(this), amount); liquidity += amount; emit LiquidityFunded(msg.sender, amount);
    }

    function collateralValueUSD(uint256 collateralETH) public view returns (uint256) { return collateralETH * oracle.priceUSD(ETH_ASSET) / 1e18; }
    function debtValueUSD(uint256 abcdAmount) public view returns (uint256) { return abcdAmount * oracle.priceUSD(address(abcd)) / 1e18; }
    function maxBorrowable(uint256 collateralETH) public view returns (uint256) {
        uint256 usd = collateralValueUSD(collateralETH) * MAX_INITIAL_LTV_BPS / BPS;
        return usd * 1e18 / oracle.priceUSD(address(abcd));
    }
    /// @notice The rate applied only to loans originated after the current governance setting.
    function currentNewLoanAprBps() external view returns (uint16) { return loanManager.newLoanAprBps(); }

    /// @notice Deposits ETH into a unique direct-pool collateral namespace before borrowing.
    function depositCollateral() external payable whenNotPaused nonReentrant returns (uint256 depositId) {
        require(msg.value != 0, "zero amount");
        depositId = nextCollateralDepositId++;
        pendingCollateral[depositId] = PendingCollateral(msg.sender, uint128(msg.value), true);
        collateralVault.depositForDirectDeposit{value: msg.value}(depositId, msg.sender);
        emit CollateralDepositCreated(depositId, msg.sender, msg.value);
    }

    /// @notice Cancels an unfunded collateral deposit. A funded deposit is bound permanently to its loan ID.
    function withdrawPendingCollateral(uint256 depositId) external nonReentrant {
        PendingCollateral memory deposit = pendingCollateral[depositId];
        require(deposit.active && deposit.borrower == msg.sender, "not pending collateral owner");
        delete pendingCollateral[depositId];
        collateralVault.releaseDirectDeposit(depositId, payable(msg.sender));
        emit PendingCollateralWithdrawn(depositId, msg.sender, deposit.amount);
    }

    function borrowABCD(uint256 depositId, uint128 principal, uint48 term)
        external whenNotPaused nonReentrant returns (uint256 loanId)
    {
        PendingCollateral memory deposit = pendingCollateral[depositId];
        require(deposit.active && deposit.borrower == msg.sender, "not pending collateral owner");
        loanId = _createLoan(depositId, principal, term, deposit.amount);
        delete pendingCollateral[depositId];
        collateralVault.bindDirectDeposit(depositId, loanId, msg.sender);
    }

    function openLoan(uint128 principal, uint48 term)
        external payable whenNotPaused nonReentrant returns (uint256 loanId)
    {
        require(msg.value != 0, "zero amount");
        loanId = _createLoan(0, principal, term, uint128(msg.value));
        collateralVault.lockDirect{value: msg.value}(loanId, msg.sender);
    }

    function _createLoan(uint256 depositId, uint128 principal, uint48 term, uint128 collateral)
        internal returns (uint256 loanId)
    {
        require(principal != 0 && collateral != 0, "zero amount");
        require(principal <= maxBorrowable(collateral), "ltv exceeded");
        require(liquidity >= principal, "insufficient liquidity");
        uint16 aprBps = loanManager.newLoanAprBps();
        loanId = loanManager.create(msg.sender, address(this), collateral, principal, aprBps, term);
        // A direct loan is rewardable only after the principal was actually
        // disbursed and the authoritative LoanManager record exists.
        lendingReferralManager.registerLoan(loanId, 0, false);
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        liquidity -= principal;
        abcd.safeTransfer(msg.sender, principal);
        emit DirectLoanOpened(loanId, depositId, msg.sender, principal, collateral, term, loan.maturity);
    }

    function syncLoan(uint256 loanId) public {
        loanManager.sync(loanId);
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        if (loan.state == LoanManagerV2.State.GRACE_PERIOD) loanNFT.setStatus(loanId, LoanNFTV2.Status.GRACE_PERIOD);
        if (loan.state == LoanManagerV2.State.DEFAULTED) loanNFT.setStatus(loanId, LoanNFTV2.Status.DEFAULTED);
    }

    function outstanding(uint256 loanId) public view returns (uint256) {
        return loanManager.previewOutstanding(loanId);
    }

    /// @notice Lets the borrower cure an on-chain risk state by increasing only that loan's collateral.
    function addCollateralToLoan(uint256 loanId) external payable whenNotPaused nonReentrant {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.borrower == msg.sender && msg.value != 0, "invalid collateral top up");
        require(loan.state == LoanManagerV2.State.ACTIVE || loan.state == LoanManagerV2.State.MARGIN_CALL || loan.state == LoanManagerV2.State.GRACE_PERIOD, "loan not active");
        collateralVault.topUpLoanCollateral{value: msg.value}(loanId, msg.sender);
        emit DirectLoanCollateralToppedUp(loanId, msg.sender, msg.value, collateralVault.loanCollateral(loanId));
    }

    /// @notice A repayment must not exceed the current exact on-chain obligation.
    function repay(uint256 loanId, uint256 amount) external nonReentrant returns (uint256 fee, uint256 interest, uint256 principal) {
        LoanManagerV2.Loan memory beforeLoan = loanManager.getLoan(loanId);
        require(beforeLoan.borrower == msg.sender, "not borrower");
        syncLoan(loanId);
        return _repay(loanId, amount, false, _emptyCompletionMetadata());
    }

    /// @notice Settles the exact in-transaction obligation, preventing a one-block interest-dust balance.
    function repayAll(uint256 loanId) external nonReentrant returns (uint256 fee, uint256 interest, uint256 principal) {
        LoanManagerV2.Loan memory beforeLoan = loanManager.getLoan(loanId);
        require(beforeLoan.borrower == msg.sender, "not borrower");
        syncLoan(loanId);
        return _repay(loanId, outstanding(loanId), false, _emptyCompletionMetadata());
    }

    /// @notice Uses publisher-produced metadata to create the three completion
    /// certificates in the same transaction as a terminal repayment.
    function repayWithCompletionMetadata(uint256 loanId, uint256 amount, LoanNFTV2.CompletionMetadata calldata metadata)
        external nonReentrant returns (uint256 fee, uint256 interest, uint256 principal)
    {
        LoanManagerV2.Loan memory beforeLoan = loanManager.getLoan(loanId);
        require(beforeLoan.borrower == msg.sender, "not borrower");
        syncLoan(loanId);
        return _repay(loanId, amount, true, metadata);
    }

    function repayAllWithCompletionMetadata(uint256 loanId, LoanNFTV2.CompletionMetadata calldata metadata)
        external nonReentrant returns (uint256 fee, uint256 interest, uint256 principal)
    {
        LoanManagerV2.Loan memory beforeLoan = loanManager.getLoan(loanId);
        require(beforeLoan.borrower == msg.sender, "not borrower");
        syncLoan(loanId);
        return _repay(loanId, outstanding(loanId), true, metadata);
    }

    function _repay(uint256 loanId, uint256 amount, bool hasCompletionMetadata, LoanNFTV2.CompletionMetadata memory metadata)
        internal returns (uint256 fee, uint256 interest, uint256 principal)
    {
        uint256 due = outstanding(loanId); require(amount != 0 && amount <= due, "invalid repayment");
        abcd.safeTransferFrom(msg.sender, address(this), amount);
        (fee, interest, principal) = loanManager.repay(loanId, msg.sender, amount);
        liquidity += amount;
        LoanManagerV2.Loan memory afterLoan = loanManager.getLoan(loanId);
        if (afterLoan.state == LoanManagerV2.State.REPAID) {
            require(hasCompletionMetadata, "completion metadata required");
            loanNFT.mintCompletionCertificates(loanId, 0, false, metadata);
        }
        emit DirectLoanRepaid(loanId, msg.sender, amount, fee, interest, principal);
    }

    function _emptyCompletionMetadata() private pure returns (LoanNFTV2.CompletionMetadata memory metadata) { }

    /// @notice ETH can leave the loan-scoped vault only after full settlement.
    function withdrawSettledCollateral(uint256 loanId) external nonReentrant {
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.borrower == msg.sender && loan.state == LoanManagerV2.State.REPAID && loanNFT.completionCreated(loanId), "not settled");
        loanManager.close(loanId);
        lendingReferralManager.recordLoanCompletion(loanId);
        uint256 amount = collateralVault.release(loanId, payable(msg.sender));
        emit SettledCollateralWithdrawn(loanId, msg.sender, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
