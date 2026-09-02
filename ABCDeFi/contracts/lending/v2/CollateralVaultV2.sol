// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Native ETH collateral is isolated by direct-deposit ID, P2P request ID, or final loan ID.
contract CollateralVaultV2 is AccessControl, ReentrancyGuard {
    bytes32 public constant VAULT_OPERATOR_ROLE = keccak256("VAULT_OPERATOR_ROLE");
    /// @dev Direct-pool deposit IDs and marketplace request IDs both begin at one.
    /// Keeping distinct mappings prevents cross-flow aggregation when their numeric IDs match.
    mapping(uint256 => uint256) public directDepositCollateral;
    mapping(uint256 => uint256) public requestCollateral;
    mapping(uint256 => uint256) public loanCollateral;
    event RequestCollateralDeposited(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event DirectDepositCollateralDeposited(uint256 indexed depositId, address indexed borrower, uint256 amount);
    event CollateralLocked(uint256 indexed loanId, uint256 indexed requestId, address indexed borrower, uint256 amount);
    event CollateralReleased(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event CollateralSeized(uint256 indexed loanId, address indexed recipient, uint256 amount);
    constructor(address admin) { _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(VAULT_OPERATOR_ROLE, admin); }
    /// @notice Escrows collateral for a P2P marketplace request.
    function depositForRequest(uint256 requestId, address borrower) external payable onlyRole(VAULT_OPERATOR_ROLE) nonReentrant { require(requestId != 0 && borrower != address(0) && msg.value != 0, "invalid deposit"); requestCollateral[requestId] += msg.value; emit RequestCollateralDeposited(requestId, borrower, msg.value); }
    /// @notice Escrows collateral for a direct-pool pending deposit in its own namespace.
    function depositForDirectDeposit(uint256 depositId, address borrower) external payable onlyRole(VAULT_OPERATOR_ROLE) nonReentrant { require(depositId != 0 && borrower != address(0) && msg.value != 0, "invalid deposit"); directDepositCollateral[depositId] += msg.value; emit DirectDepositCollateralDeposited(depositId, borrower, msg.value); }
    function lockDirect(uint256 loanId, address borrower) external payable onlyRole(VAULT_OPERATOR_ROLE) { require(loanId != 0 && borrower != address(0) && msg.value != 0 && loanCollateral[loanId] == 0, "invalid lock"); loanCollateral[loanId] = msg.value; emit CollateralLocked(loanId, 0, borrower, msg.value); }
    function bindRequest(uint256 requestId, uint256 loanId, address borrower) external onlyRole(VAULT_OPERATOR_ROLE) { uint256 amount=requestCollateral[requestId]; require(amount != 0 && loanCollateral[loanId] == 0, "invalid bind"); requestCollateral[requestId]=0; loanCollateral[loanId]=amount; emit CollateralLocked(loanId, requestId, borrower, amount); }
    function bindDirectDeposit(uint256 depositId, uint256 loanId, address borrower) external onlyRole(VAULT_OPERATOR_ROLE) { uint256 amount=directDepositCollateral[depositId]; require(amount != 0 && loanCollateral[loanId] == 0, "invalid bind"); directDepositCollateral[depositId]=0; loanCollateral[loanId]=amount; emit CollateralLocked(loanId, depositId, borrower, amount); }
    function releaseRequest(uint256 requestId, address payable borrower) external onlyRole(VAULT_OPERATOR_ROLE) nonReentrant returns(uint256 amount) { amount=requestCollateral[requestId]; require(amount != 0, "no request collateral"); requestCollateral[requestId]=0; (bool ok,)=borrower.call{value:amount}(""); require(ok,"eth transfer failed"); emit CollateralReleased(requestId, borrower, amount); }
    function releaseDirectDeposit(uint256 depositId, address payable borrower) external onlyRole(VAULT_OPERATOR_ROLE) nonReentrant returns(uint256 amount) { amount=directDepositCollateral[depositId]; require(amount != 0, "no direct deposit collateral"); directDepositCollateral[depositId]=0; (bool ok,)=borrower.call{value:amount}(""); require(ok,"eth transfer failed"); emit CollateralReleased(depositId, borrower, amount); }
    function release(uint256 loanId, address payable borrower) external onlyRole(VAULT_OPERATOR_ROLE) nonReentrant returns(uint256 amount) { amount=loanCollateral[loanId]; require(amount != 0, "no collateral"); loanCollateral[loanId]=0; (bool ok,)=borrower.call{value:amount}(""); require(ok,"eth transfer failed"); emit CollateralReleased(loanId, borrower, amount); }
    function seize(uint256 loanId, address payable recipient, uint256 amount) external onlyRole(VAULT_OPERATOR_ROLE) nonReentrant { require(amount != 0 && amount <= loanCollateral[loanId], "invalid seizure"); loanCollateral[loanId]-=amount; (bool ok,)=recipient.call{value:amount}(""); require(ok,"eth transfer failed"); emit CollateralSeized(loanId,recipient,amount); }
}
