// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Native ETH collateral is isolated by request ID or final loan ID.
contract CollateralVaultV2 is AccessControl, ReentrancyGuard {
    bytes32 public constant VAULT_OPERATOR_ROLE = keccak256("VAULT_OPERATOR_ROLE");
    mapping(uint256 => uint256) public requestCollateral;
    mapping(uint256 => uint256) public loanCollateral;
    event RequestCollateralDeposited(uint256 indexed requestId, address indexed borrower, uint256 amount);
    event CollateralLocked(uint256 indexed loanId, uint256 indexed requestId, address indexed borrower, uint256 amount);
    event CollateralReleased(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event CollateralSeized(uint256 indexed loanId, address indexed recipient, uint256 amount);
    constructor(address admin) { _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(VAULT_OPERATOR_ROLE, admin); }
    function depositForRequest(uint256 requestId, address borrower) external payable nonReentrant { require(requestId != 0 && borrower != address(0) && msg.value != 0, "invalid deposit"); requestCollateral[requestId] += msg.value; emit RequestCollateralDeposited(requestId, borrower, msg.value); }
    function lockDirect(uint256 loanId, address borrower) external payable onlyRole(VAULT_OPERATOR_ROLE) { require(loanId != 0 && borrower != address(0) && msg.value != 0 && loanCollateral[loanId] == 0, "invalid lock"); loanCollateral[loanId] = msg.value; emit CollateralLocked(loanId, 0, borrower, msg.value); }
    function bindRequest(uint256 requestId, uint256 loanId, address borrower) external onlyRole(VAULT_OPERATOR_ROLE) { uint256 amount=requestCollateral[requestId]; require(amount != 0 && loanCollateral[loanId] == 0, "invalid bind"); requestCollateral[requestId]=0; loanCollateral[loanId]=amount; emit CollateralLocked(loanId, requestId, borrower, amount); }
    function releaseRequest(uint256 requestId, address payable borrower) external onlyRole(VAULT_OPERATOR_ROLE) nonReentrant returns(uint256 amount) { amount=requestCollateral[requestId]; require(amount != 0, "no request collateral"); requestCollateral[requestId]=0; (bool ok,)=borrower.call{value:amount}(""); require(ok,"eth transfer failed"); emit CollateralReleased(requestId, borrower, amount); }
    function release(uint256 loanId, address payable borrower) external onlyRole(VAULT_OPERATOR_ROLE) nonReentrant returns(uint256 amount) { amount=loanCollateral[loanId]; require(amount != 0, "no collateral"); loanCollateral[loanId]=0; (bool ok,)=borrower.call{value:amount}(""); require(ok,"eth transfer failed"); emit CollateralReleased(loanId, borrower, amount); }
    function seize(uint256 loanId, address payable recipient, uint256 amount) external onlyRole(VAULT_OPERATOR_ROLE) nonReentrant { require(amount != 0 && amount <= loanCollateral[loanId], "invalid seizure"); loanCollateral[loanId]-=amount; (bool ok,)=recipient.call{value:amount}(""); require(ok,"eth transfer failed"); emit CollateralSeized(loanId,recipient,amount); }
}
