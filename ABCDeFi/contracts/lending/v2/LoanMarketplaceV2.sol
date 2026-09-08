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
import "./EMIManagerV2.sol";
import "./LendingReferralManagerV2.sol";
import "./IP2PSettlementCallbackV2.sol";
import "../../nft/LoanNFTV2.sol";

/// @notice V2 P2P marketplace with request-scoped collateral and bounded deterministic EMI schedules.
contract LoanMarketplaceV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public constant ETH_ASSET = address(1);
    /// @notice P2P ETH requests use the whitepaper's ETH-specific 35% initial LTV.
    /// Direct Lending V2 keeps its independent 50% policy in LendingPoolV2.
    uint16 public constant P2P_INITIAL_LTV_BPS = 3_500;
    uint256 private constant BPS_DENOMINATOR = 10_000;
    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    OracleAdapterV2 public immutable oracle;
    LoanNFTV2 public immutable loanNFT;
    LendingReferralManagerV2 public immutable lendingReferralManager;
    EMIManagerV2 public emiManager;
    address public liquidationEngine;
    bytes32 public constant LIQUIDATION_SETTLEMENT_ROLE = keccak256("LIQUIDATION_SETTLEMENT_ROLE");
    uint256 public nextRequestId = 1;
    enum RequestState { OPEN, FUNDED, CANCELLED, SETTLED }
    struct Request { address borrower; uint128 principal; uint128 collateral; uint48 term; RequestState state; address lender; string metadataURI; bytes32 metadataHash; uint256 loanId; uint16 initialLtvBps; }
    mapping(uint256 => Request) public requests;
    mapping(uint256 => uint256) public requestByLoanId;
    event RequestCreated(uint256 indexed requestId, address indexed borrower, uint256 principal, uint256 collateral, uint48 term, bytes32 metadataHash, string metadataURI, uint16 initialLtvBps);
    event RequestFunded(uint256 indexed requestId, uint256 indexed loanId, address indexed lender, uint256 principal, uint256 collateral, uint48 maturity);
    event RequestRepaid(uint256 indexed requestId, uint256 indexed loanId, address indexed borrower, address lender);
    event RequestCancelled(uint256 indexed requestId);
    event P2PLiquidationSettled(uint256 indexed requestId, uint256 indexed loanId, address indexed liquidator, address lender, uint256 debtCovered, uint256 collateralToLiquidator, uint256 reserveContribution, uint256 badDebt, uint256 borrowerSurplus);
    event P2PDefaultSettled(uint256 indexed requestId, uint256 indexed loanId, address lender, uint256 collateralToLender, uint256 borrowerSurplus, uint256 borrowerLiability);

    constructor(address admin, address abcd_, address manager_, address vault_, address oracle_, address loanNFT_, address lendingReferralManager_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && oracle_ != address(0) && loanNFT_ != address(0) && lendingReferralManager_ != address(0), "invalid address");
        abcd=IERC20(abcd_); loanManager=LoanManagerV2(manager_); collateralVault=CollateralVaultV2(vault_); oracle=OracleAdapterV2(oracle_); loanNFT=LoanNFTV2(loanNFT_); lendingReferralManager=LendingReferralManagerV2(lendingReferralManager_); _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setEMIManager(address manager_) external onlyRole(DEFAULT_ADMIN_ROLE) { require(address(emiManager)==address(0) && manager_!=address(0), "already configured"); emiManager=EMIManagerV2(manager_); }
    function setLiquidationEngine(address engine_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(liquidationEngine == address(0) && engine_ != address(0), "already configured");
        liquidationEngine = engine_;
        _grantRole(LIQUIDATION_SETTLEMENT_ROLE, engine_);
    }
    /// @notice Canonical USD value (18 decimals) for ETH request collateral.
    /// OracleAdapterV2 rejects paused, stale, invalid, or unavailable feeds.
    function collateralValueUSD(uint256 collateralETH) public view returns (uint256) {
        return collateralETH * oracle.priceUSD(ETH_ASSET) / 1e18;
    }
    /// @notice Maximum ABCD principal (18 decimals) for ETH-backed P2P collateral.
    function previewMaxP2PPrincipal(uint256 collateralETH) public view returns (uint256) {
        uint256 abcdPrice = oracle.priceUSD(address(abcd));
        return collateralValueUSD(collateralETH) * P2P_INITIAL_LTV_BPS / BPS_DENOMINATOR * 1e18 / abcdPrice;
    }
    function createRequest(uint128 principal, uint48 term, string calldata metadataURI, bytes32 metadataHash) external payable whenNotPaused nonReentrant returns(uint256 requestId) {
        require(principal != 0 && msg.value != 0 && (term==30 days || term==90 days || term==180 days), "invalid request");
        require(bytes(metadataURI).length != 0 && metadataHash != bytes32(0), "metadata required");
        require(principal <= previewMaxP2PPrincipal(msg.value), "p2p ltv exceeded");
        requestId=nextRequestId++; collateralVault.depositForRequest{value:msg.value}(requestId,msg.sender);
        // Record the accepted policy on the request so later policy changes do
        // not change how this historical request is interpreted.
        requests[requestId]=Request(msg.sender,principal,uint128(msg.value),term,RequestState.OPEN,address(0),metadataURI,metadataHash,0,P2P_INITIAL_LTV_BPS);
        emit RequestCreated(requestId,msg.sender,principal,msg.value,term,metadataHash,metadataURI,P2P_INITIAL_LTV_BPS);
    }
    function cancelRequest(uint256 requestId) external nonReentrant { Request storage r=requests[requestId]; require(r.borrower==msg.sender && r.state==RequestState.OPEN,"not cancellable"); r.state=RequestState.CANCELLED; collateralVault.releaseRequest(requestId,payable(msg.sender)); emit RequestCancelled(requestId); }
    function fundRequest(uint256 requestId) external whenNotPaused nonReentrant returns(uint256 loanId) {
        Request storage r=requests[requestId]; require(r.state==RequestState.OPEN && r.borrower!=msg.sender && address(emiManager)!=address(0),"not fundable");
        r.state=RequestState.FUNDED; r.lender=msg.sender; abcd.safeTransferFrom(msg.sender,r.borrower,r.principal);
        uint16 aprBps = loanManager.newLoanAprBps();
        loanId=loanManager.create(r.borrower,msg.sender,r.collateral,r.principal,aprBps,r.term); r.loanId=loanId; requestByLoanId[loanId]=requestId;
        // Funding, rather than request creation, establishes the actual P2P
        // lender/borrower relationship eligible for referral accounting.
        lendingReferralManager.registerLoan(loanId, requestId, true);
        collateralVault.bindRequest(requestId,loanId,r.borrower); LoanManagerV2.Loan memory loan=loanManager.getLoan(loanId);
        emiManager.createSchedule(loanId,r.term); emit RequestFunded(requestId,loanId,msg.sender,r.principal,r.collateral,loan.maturity);
    }
    /// @notice Called only by the configured EMI manager inside a successful repayment.
    /// The manager's CLOSED state is the authority; this records the matching
    /// marketplace terminal state before collateral is released to the borrower.
    function markLoanRepaid(uint256 loanId) external {
        require(msg.sender == address(emiManager), "not EMI manager");
        uint256 requestId = requestByLoanId[loanId]; require(requestId != 0, "missing request");
        Request storage r = requests[requestId];
        require(r.state == RequestState.FUNDED && r.loanId == loanId, "not funded request");
        require(loanManager.getLoan(loanId).state == LoanManagerV2.State.CLOSED, "loan not closed");
        r.state = RequestState.SETTLED;
        emit RequestRepaid(requestId, loanId, r.borrower, r.lender);
    }
    function isP2PLoan(uint256 loanId) external view returns (bool) {
        uint256 requestId = requestByLoanId[loanId];
        return requestId != 0 && requests[requestId].state == RequestState.FUNDED && requests[requestId].loanId == loanId;
    }
    /// @notice Terminal P2P-only callback from the configured risk engine. The
    /// engine pays the lender directly; no P2P proceeds enter the direct pool.
    function settleLiquidation(uint256 loanId, address payable liquidator, uint256 debtCovered, uint256 collateralToLiquidator, uint256 reserveContribution, uint256 badDebt)
        external onlyRole(LIQUIDATION_SETTLEMENT_ROLE) nonReentrant
    {
        uint256 requestId = requestByLoanId[loanId]; require(requestId != 0, "missing request");
        Request storage r = requests[requestId]; require(r.state == RequestState.FUNDED && r.loanId == loanId, "not funded request");
        LoanManagerV2.Loan memory loan = loanManager.getLoan(loanId);
        require(loan.state == LoanManagerV2.State.ACTIVE || loan.state == LoanManagerV2.State.GRACE_PERIOD || loan.state == LoanManagerV2.State.MARGIN_CALL || loan.state == LoanManagerV2.State.DEFAULTED, "not liquidatable");
        loanManager.liquidate(loanId, debtCovered, reserveContribution, badDebt);
        loanNFT.setStatus(loanId, LoanNFTV2.Status.LIQUIDATED);
        if (collateralToLiquidator != 0) collateralVault.seize(loanId, liquidator, collateralToLiquidator);
        uint256 surplus = collateralVault.loanCollateral(loanId);
        if (surplus != 0) collateralVault.release(loanId, payable(r.borrower));
        r.state = RequestState.SETTLED;
        emit P2PLiquidationSettled(requestId, loanId, liquidator, r.lender, debtCovered, collateralToLiquidator, reserveContribution, badDebt, surplus);
    }
    function settleDefault(uint256 requestId) external whenNotPaused nonReentrant {
        Request storage r=requests[requestId]; require(r.state==RequestState.FUNDED,"not funded"); loanManager.sync(r.loanId);
        LoanManagerV2.Loan memory loan=loanManager.getLoan(r.loanId); require(loan.state==LoanManagerV2.State.DEFAULTED,"not defaulted");
        uint256 debt=uint256(loan.principalOutstanding)+loan.accruedInterest+loan.fees; uint256 ethPrice=oracle.priceUSD(ETH_ASSET); uint256 tokenPrice=oracle.priceUSD(address(abcd));
        uint256 neededETH=debt*tokenPrice*1e18/ethPrice; uint256 collateral=collateralVault.loanCollateral(r.loanId); uint256 toLender=neededETH<collateral?neededETH:collateral;
        uint256 recovered=toLender*ethPrice/tokenPrice; if(recovered>debt) recovered=debt; uint256 liability=debt-recovered;
        if(toLender!=0) collateralVault.seize(r.loanId,payable(r.lender),toLender); uint256 surplus=collateralVault.loanCollateral(r.loanId); if(surplus!=0) collateralVault.release(r.loanId,payable(r.borrower));
        loanManager.liquidate(r.loanId,recovered,0,liability); loanNFT.setStatus(r.loanId,LoanNFTV2.Status.LIQUIDATED); r.state=RequestState.SETTLED;
        emit P2PDefaultSettled(requestId,r.loanId,r.lender,toLender,surplus,liability);
    }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
