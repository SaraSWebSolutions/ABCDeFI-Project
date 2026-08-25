// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../libraries/Constants.sol";
import "../libraries/Errors.sol";
import "../interfaces/ILoanManager.sol";
import "../interfaces/ICollateralVault.sol";
import "../interfaces/IEMIManager.sol";
import "../interfaces/ILoanNFT.sol";

/**
 * @title LoanMarketplace
 * @notice P2P Lending Marketplace. Borrowers create requests with collateral; Lenders fund them.
 */
contract LoanMarketplace is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable borrowToken;
    ILoanManager public immutable loanManager;
    ICollateralVault public immutable collateralVault;
    IEMIManager public emiManager;
    ILoanNFT public loanNFT;
    address public immutable platformRecipient;

    bytes32 public constant EMI_OPERATOR_ROLE = keccak256("EMI_OPERATOR_ROLE");

    enum RequestStatus { OPEN, FUNDED, CANCELLED }

    struct LoanRequest {
        uint256 id;
        address borrower;
        uint256 principalAmount;
        uint256 interestRateBps;
        uint256 durationMonths;
        uint256 emiAmount;
        uint256 collateralETH;
        string purpose;
        RequestStatus status;
        address lender;
    }

    uint256 private _nextRequestId = 1;
    mapping(uint256 => LoanRequest) public loanRequests;
    mapping(uint256 => uint256) public loanIdToRequestId;
    
    // Arrays for easy frontend iteration
    uint256[] public openRequests;

    event RequestCreated(uint256 indexed requestId, address indexed borrower, uint256 principal, uint256 collateralETH);
    event RequestFunded(uint256 indexed requestId, address indexed lender, uint256 loanId);
    event RequestCancelled(uint256 indexed requestId, address indexed borrower);
    event EMIManagerUpdated(address indexed previousManager, address indexed newManager);
    event LoanNFTUpdated(address indexed previousLoanNFT, address indexed newLoanNFT);
    event P2PLoanLiquidated(uint256 indexed loanId, uint256 indexed requestId, address indexed lender, uint256 collateralETH);

    constructor(
        address admin,
        address _borrowToken,
        address _loanManager,
        address _collateralVault
    ) {
        if (admin == address(0) || _borrowToken == address(0) || _loanManager == address(0) || _collateralVault == address(0)) revert Errors.InvalidAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(Constants.PAUSER_ROLE, admin);

        borrowToken = IERC20(_borrowToken);
        loanManager = ILoanManager(_loanManager);
        collateralVault = ICollateralVault(_collateralVault);
        platformRecipient = admin;
        _grantRole(EMI_OPERATOR_ROLE, admin);
    }

    /**
     * @notice Configure the canonical EMI manager. This can only be set once by the protocol admin.
     * @dev A one-time setter avoids the circular deployment dependency between Marketplace and EMIManager.
     */
    function setEMIManager(address _emiManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_emiManager == address(0)) revert Errors.InvalidAddress();
        if (address(emiManager) != address(0)) revert Errors.InvalidParameter("EMI manager already configured");

        address previousManager = address(emiManager);
        emiManager = IEMIManager(_emiManager);
        emit EMIManagerUpdated(previousManager, _emiManager);
    }

    /**
     * @notice One-time LoanNFT configuration after the marketplace/LoanNFT
     * deployment cycle has been resolved. LoanNFT itself grants this
     * marketplace MINTER_ROLE; this setter never grants or bypasses a role.
     */
    function setLoanNFT(address _loanNFT) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_loanNFT == address(0)) revert Errors.InvalidAddress();
        if (address(loanNFT) != address(0)) revert Errors.InvalidParameter("Loan NFT already configured");

        address previousLoanNFT = address(loanNFT);
        loanNFT = ILoanNFT(_loanNFT);
        emit LoanNFTUpdated(previousLoanNFT, _loanNFT);
    }

    /**
     * @notice Create a loan request by escrowing native ETH collateral.
     */
    function createLoanRequest(
        uint256 principalAmount,
        uint256 interestRateBps,
        uint256 durationMonths,
        string calldata purpose
    ) external payable whenNotPaused nonReentrant returns (uint256) {
        if (principalAmount == 0 || msg.value == 0) revert Errors.ZeroAmount();
        if (durationMonths == 0) revert Errors.InvalidParameter("Duration cannot be 0");

        // Collateral is held by the canonical CollateralVault, not this marketplace.
        collateralVault.depositETH{value: msg.value}(msg.sender);

        // Calculate expected EMI (simplified formula for P2P fixed interest)
        // EMI = (Principal + Total Interest) / Duration
        uint256 totalInterest = (principalAmount * interestRateBps * durationMonths) / (12 * Constants.BPS_DENOMINATOR);
        uint256 totalOwed = principalAmount + totalInterest;
        uint256 emiAmount = totalOwed / durationMonths;

        uint256 requestId = _nextRequestId++;

        loanRequests[requestId] = LoanRequest({
            id: requestId,
            borrower: msg.sender,
            principalAmount: principalAmount,
            interestRateBps: interestRateBps,
            durationMonths: durationMonths,
            emiAmount: emiAmount,
            collateralETH: msg.value,
            purpose: purpose,
            status: RequestStatus.OPEN,
            lender: address(0)
        });

        openRequests.push(requestId);

        emit RequestCreated(requestId, msg.sender, principalAmount, msg.value);
        return requestId;
    }

    /**
     * @notice Fund an open loan request. Transfers principal from Lender to Borrower.
     */
    function fundLoanRequest(uint256 requestId) external whenNotPaused nonReentrant {
        LoanRequest storage request = loanRequests[requestId];
        
        if (request.status != RequestStatus.OPEN) revert Errors.InvalidParameter("Request not open");
        if (request.borrower == msg.sender) revert Errors.InvalidParameter("Cannot fund own request");
        if (address(loanNFT) == address(0)) revert Errors.InvalidParameter("Loan NFT not configured");

        // 1. Mark as funded
        request.status = RequestStatus.FUNDED;
        request.lender = msg.sender;

        // 2. Transfer principal from Lender -> Borrower directly
        borrowToken.safeTransferFrom(msg.sender, request.borrower, request.principalAmount);

        // 3. Register loan in LoanManager so EMI schedules and defaults can be tracked
        uint256 loanId = loanManager.createLoan(
            request.borrower,
            msg.sender,
            request.principalAmount,
            request.collateralETH,
            request.interestRateBps,
            request.durationMonths,
            request.emiAmount
        );
        loanIdToRequestId[loanId] = requestId;

        // The marketplace is the only component that knows the final loanId at funding time.
        // Create the immutable on-chain EMI schedule immediately after the loan is activated.
        if (address(emiManager) == address(0)) revert Errors.InvalidParameter("EMI manager not configured");
        emiManager.createSchedule(
            loanId,
            request.durationMonths,
            request.emiAmount,
            request.principalAmount + ((request.principalAmount * request.interestRateBps * request.durationMonths) / (12 * Constants.BPS_DENOMINATOR)),
            block.timestamp
        );

        // The loan is now active and all immutable loan metadata is known.
        // LoanNFT enforces that only this marketplace can mint certificates.
        loanNFT.mintAllLoanNFTs(
            loanId,
            request.borrower,
            msg.sender,
            platformRecipient,
            request.principalAmount,
            request.collateralETH,
            request.interestRateBps,
            request.durationMonths,
            "",
            ILoanNFT.LoanStatus.ACTIVE
        );

        emit RequestFunded(requestId, msg.sender, loanId);
    }

    /**
     * @notice Borrower cancels an unfunded request and reclaims collateral.
     */
    function cancelLoanRequest(uint256 requestId) external whenNotPaused nonReentrant {
        LoanRequest storage request = loanRequests[requestId];
        if (request.borrower != msg.sender) revert Errors.UnauthorizedAccount(msg.sender, bytes32(0));
        if (request.status != RequestStatus.OPEN) revert Errors.InvalidParameter("Request not open");

        request.status = RequestStatus.CANCELLED;

        collateralVault.releaseETH(payable(msg.sender), request.collateralETH);

        emit RequestCancelled(requestId, msg.sender);
    }

    /**
     * @notice If loan defaults or completes, the LoanManager allows withdrawal of this collateral to Lender/Borrower.
     * This requires LoanManager to be able to call this contract.
     * Simplified for implementation plan: anyone with LOAN_OPERATOR_ROLE can release collateral.
     */
    function releaseCollateral(uint256 requestId, address to) external nonReentrant {
        if (!hasRole(Constants.LOAN_OPERATOR_ROLE, msg.sender)) revert Errors.UnauthorizedAccount(msg.sender, Constants.LOAN_OPERATOR_ROLE);
        
        LoanRequest storage request = loanRequests[requestId];
        uint256 amount = request.collateralETH;
        if (amount == 0 || to == address(0)) revert Errors.ZeroAmount();
        request.collateralETH = 0; // Prevent double release
        collateralVault.releaseETH(payable(to), amount);
    }

    function releaseRepaidCollateral(uint256 loanId, address borrower) external nonReentrant {
        if (!hasRole(EMI_OPERATOR_ROLE, msg.sender) && !hasRole(Constants.LOAN_MANAGER_ADMIN_ROLE, msg.sender)) {
            revert Errors.UnauthorizedAccount(msg.sender, EMI_OPERATOR_ROLE);
        }
        uint256 requestId = loanIdToRequestId[loanId];
        LoanRequest storage request = loanRequests[requestId];
        if (request.status != RequestStatus.FUNDED || request.borrower != borrower) {
            revert Errors.InvalidParameter("Loan not releasable");
        }
        if (loanManager.getLoan(loanId).status != ILoanManager.LoanStatus.REPAID) revert Errors.InvalidState();
        loanNFT.updateLoanStatusForLoan(loanId, ILoanNFT.LoanStatus.COMPLETED);
        uint256 amount = request.collateralETH;
        if (amount == 0) revert Errors.ZeroAmount();
        request.collateralETH = 0;
        collateralVault.releaseETH(payable(borrower), amount);
    }

    /** @notice Called only by EMIManager after it marks a P2P loan defaulted. */
    function markLoanNFTDefaulted(uint256 loanId) external nonReentrant onlyRole(EMI_OPERATOR_ROLE) {
        if (loanManager.getLoan(loanId).status != ILoanManager.LoanStatus.DEFAULTED) revert Errors.InvalidState();
        loanNFT.updateLoanStatusForLoan(loanId, ILoanNFT.LoanStatus.DEFAULTED);
    }

    /**
     * @notice Settle a defaulted P2P loan by transferring its recorded collateral to its lender.
     * @dev Default must first be established by EMIManager after the payment grace period.
     */
    function liquidateDefaultedLoan(uint256 loanId) external whenNotPaused nonReentrant {
        uint256 requestId = loanIdToRequestId[loanId];
        LoanRequest storage request = loanRequests[requestId];
        if (request.status != RequestStatus.FUNDED || request.lender == address(0)) {
            revert Errors.InvalidParameter("Loan not liquidatable");
        }
        if (loanManager.getLoan(loanId).status != ILoanManager.LoanStatus.DEFAULTED) revert Errors.InvalidState();

        uint256 amount = request.collateralETH;
        if (amount == 0) revert Errors.ZeroAmount();
        request.collateralETH = 0;

        collateralVault.liquidateBorrowerETH(request.borrower, payable(request.lender), amount);
        loanManager.recordLiquidation(loanId);
        loanNFT.updateLoanStatusForLoan(loanId, ILoanNFT.LoanStatus.LIQUIDATED);

        emit P2PLoanLiquidated(loanId, requestId, request.lender, amount);
    }

    function pause() external onlyRole(Constants.PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(Constants.PAUSER_ROLE) {
        _unpause();
    }
}
