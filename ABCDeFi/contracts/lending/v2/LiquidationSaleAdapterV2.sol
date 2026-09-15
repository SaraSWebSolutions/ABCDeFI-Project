// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ILiquidationSaleAdapterV2.sol";
import "./ILiquidationPriceValidatorV2.sol";
import "./IPancakeSwapRouterV2.sol";
import "./IWETHV2.sol";

/// @notice Configuration-gated adapter. Production execution is impossible until all external addresses are configured.
contract LiquidationSaleAdapterV2 is AccessControl, ReentrancyGuard, ILiquidationSaleAdapterV2 {
    using SafeERC20 for IERC20;
    bytes32 public constant CONFIG_ADMIN_ROLE = keccak256("CONFIG_ADMIN_ROLE");
    address public liquidation; address public collateralVault; IERC20 public immutable abcd;
    address public weth; address public router; ILiquidationPriceValidatorV2 public validator; uint48 public maxDeadlineSeconds;
    address[] private route; mapping(uint256 => Recovery) private recoveries; mapping(uint256 => uint256) public pendingCollateral;
    event SaleConfigured(address indexed liquidation, address indexed vault, address indexed weth, address router, address validator, uint48 maxDeadlineSeconds, bytes32 routeHash);
    event CollateralReceived(uint256 indexed loanId, uint256 amount);
    event CollateralRecoveryFinalized(uint256 indexed loanId, uint256 collateralAmount, uint256 actualABCDReceived, address indexed router, bytes32 routeHash);
    constructor(address admin, address abcd_) { require(admin != address(0) && abcd_ != address(0), "invalid address"); abcd = IERC20(abcd_); _grantRole(DEFAULT_ADMIN_ROLE, admin); _grantRole(CONFIG_ADMIN_ROLE, admin); }
    function configured() public view returns (bool) { return liquidation != address(0) && collateralVault != address(0) && weth != address(0) && router != address(0) && address(validator) != address(0) && maxDeadlineSeconds != 0 && route.length >= 2; }
    function configure(address liquidation_, address vault_, address weth_, address router_, address validator_, uint48 maxDeadlineSeconds_, address[] calldata route_) external onlyRole(CONFIG_ADMIN_ROLE) {
        require(!configured(), "already configured"); require(liquidation_ != address(0) && vault_ != address(0) && weth_ != address(0) && router_ != address(0) && validator_ != address(0) && maxDeadlineSeconds_ != 0, "invalid config");
        require(liquidation_.code.length != 0 && vault_.code.length != 0 && weth_.code.length != 0 && router_.code.length != 0 && validator_.code.length != 0, "config has no code");
        require(route_.length >= 2 && route_[0] == weth_ && route_[route_.length - 1] == address(abcd), "invalid route");
        liquidation=liquidation_; collateralVault=vault_; weth=weth_; router=router_; validator=ILiquidationPriceValidatorV2(validator_); maxDeadlineSeconds=maxDeadlineSeconds_;
        for(uint256 i; i<route_.length; ++i) { require(route_[i] != address(0), "route=0"); route.push(route_[i]); }
        emit SaleConfigured(liquidation_, vault_, weth_, router_, validator_, maxDeadlineSeconds_, keccak256(abi.encode(route_)));
    }
    function quote(uint256 loanId, uint256 debt, uint256 collateral, uint16 targetLtvBps) public view returns (SaleQuote memory q) {
        require(configured(), "sale configuration required"); (q.collateralAmount,q.minOut,q.deadline)=validator.quoteSale(loanId,debt,collateral,targetLtvBps);
        require(q.collateralAmount != 0 && q.collateralAmount <= collateral, "invalid sale amount"); require(q.minOut != 0, "minOut required"); require(q.deadline >= block.timestamp && q.deadline <= block.timestamp + maxDeadlineSeconds, "invalid deadline");
    }
    function receiveCollateral(uint256 loanId) external payable { require(msg.sender == collateralVault && msg.value != 0 && pendingCollateral[loanId] == 0, "invalid collateral receipt"); require(!recoveries[loanId].finalized, "recovery finalized"); pendingCollateral[loanId]=msg.value; emit CollateralReceived(loanId,msg.value); }
    function executeSale(uint256 loanId,uint256 debt,uint256 collateral,uint16 targetLtvBps) external nonReentrant returns(uint256 actualReceived) {
        require(msg.sender == liquidation, "only liquidation"); require(!recoveries[loanId].finalized, "recovery finalized"); SaleQuote memory q=quote(loanId,debt,collateral,targetLtvBps); require(pendingCollateral[loanId] == q.collateralAmount, "unexpected collateral"); pendingCollateral[loanId]=0;
        uint256 beforeBalance=abcd.balanceOf(address(this)); IWETHV2(weth).deposit{value:q.collateralAmount}(); IERC20(weth).forceApprove(router,q.collateralAmount); IPancakeSwapRouterV2(router).swapExactTokensForTokens(q.collateralAmount,q.minOut,route,address(this),q.deadline);
        actualReceived=abcd.balanceOf(address(this))-beforeBalance; require(actualReceived != 0 && actualReceived >= q.minOut,"insufficient recovery"); recoveries[loanId]=Recovery(q.collateralAmount,actualReceived,true,false); abcd.safeTransfer(liquidation,actualReceived); emit CollateralRecoveryFinalized(loanId,q.collateralAmount,actualReceived,router,keccak256(abi.encode(route)));
    }
    function consumeRecovery(uint256 loanId) external returns(Recovery memory result) { require(msg.sender == liquidation,"only liquidation"); result=recoveries[loanId]; require(result.finalized && !result.consumed,"recovery unavailable"); recoveries[loanId].consumed=true; }
    function recoveryOf(uint256 loanId) external view returns(Recovery memory) { return recoveries[loanId]; }
}
