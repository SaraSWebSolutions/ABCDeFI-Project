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
import "../../nft/LoanNFTV2.sol";

/// @notice V2 P2P marketplace with request-scoped collateral and bounded deterministic EMI schedules.
contract LoanMarketplaceV2 is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public constant ETH_ASSET = address(1);
    IERC20 public immutable abcd;
    LoanManagerV2 public immutable loanManager;
    CollateralVaultV2 public immutable collateralVault;
    OracleAdapterV2 public immutable oracle;
    LoanNFTV2 public immutable loanNFT;
    EMIManagerV2 public emiManager;
    uint256 public nextRequestId = 1;
    enum RequestState { OPEN, FUNDED, CANCELLED, SETTLED }
    struct Request { address borrower; uint128 principal; uint128 collateral; uint48 term; RequestState state; address lender; string metadataURI; bytes32 metadataHash; uint256 loanId; }
    mapping(uint256 => Request) public requests;
    event RequestCreated(uint256 indexed requestId, address indexed borrower, uint256 principal, uint256 collateral, uint48 term, bytes32 metadataHash, string metadataURI);
    event RequestFunded(uint256 indexed requestId, uint256 indexed loanId, address indexed lender, uint256 principal, uint256 collateral, uint48 maturity);
    event RequestCancelled(uint256 indexed requestId);
    event P2PDefaultSettled(uint256 indexed requestId, uint256 indexed loanId, address lender, uint256 collateralToLender, uint256 borrowerSurplus, uint256 borrowerLiability);

    constructor(address admin, address abcd_, address manager_, address vault_, address oracle_, address loanNFT_) {
        require(admin != address(0) && abcd_ != address(0) && manager_ != address(0) && vault_ != address(0) && oracle_ != address(0) && loanNFT_ != address(0), "invalid address");
        abcd=IERC20(abcd_); loanManager=LoanManagerV2(manager_); collateralVault=CollateralVaultV2(vault_); oracle=OracleAdapterV2(oracle_); loanNFT=LoanNFTV2(loanNFT_); _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setEMIManager(address manager_) external onlyRole(DEFAULT_ADMIN_ROLE) { require(address(emiManager)==address(0) && manager_!=address(0), "already configured"); emiManager=EMIManagerV2(manager_); }
    function createRequest(uint128 principal, uint48 term, string calldata metadataURI, bytes32 metadataHash) external payable whenNotPaused nonReentrant returns(uint256 requestId) {
        require(principal != 0 && msg.value != 0 && (term==30 days || term==90 days || term==180 days), "invalid request");
        require(bytes(metadataURI).length != 0 && metadataHash != bytes32(0), "metadata required");
        requestId=nextRequestId++; collateralVault.depositForRequest{value:msg.value}(requestId,msg.sender);
        requests[requestId]=Request(msg.sender,principal,uint128(msg.value),term,RequestState.OPEN,address(0),metadataURI,metadataHash,0);
        emit RequestCreated(requestId,msg.sender,principal,msg.value,term,metadataHash,metadataURI);
    }
    function cancelRequest(uint256 requestId) external nonReentrant { Request storage r=requests[requestId]; require(r.borrower==msg.sender && r.state==RequestState.OPEN,"not cancellable"); r.state=RequestState.CANCELLED; collateralVault.releaseRequest(requestId,payable(msg.sender)); emit RequestCancelled(requestId); }
    function fundRequest(uint256 requestId) external whenNotPaused nonReentrant returns(uint256 loanId) {
        Request storage r=requests[requestId]; require(r.state==RequestState.OPEN && r.borrower!=msg.sender && address(emiManager)!=address(0),"not fundable");
        r.state=RequestState.FUNDED; r.lender=msg.sender; abcd.safeTransferFrom(msg.sender,r.borrower,r.principal);
        loanId=loanManager.create(r.borrower,msg.sender,r.collateral,r.principal,1_200,r.term); r.loanId=loanId;
        collateralVault.bindRequest(requestId,loanId,r.borrower); LoanManagerV2.Loan memory loan=loanManager.getLoan(loanId);
        loanNFT.mintP2P(r.borrower,msg.sender,loanId,r.principal,r.collateral,loan.aprBps,loan.start,loan.maturity,r.metadataURI,r.metadataHash);
        emiManager.createSchedule(loanId,r.term); emit RequestFunded(requestId,loanId,msg.sender,r.principal,r.collateral,loan.maturity);
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
