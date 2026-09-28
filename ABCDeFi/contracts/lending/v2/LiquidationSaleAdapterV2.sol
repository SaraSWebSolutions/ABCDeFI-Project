// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./ILiquidationSaleAdapterV2.sol";
import "./ILiquidationPriceValidatorV2.sol";
import "./IPancakeSwapRouterV2.sol";
import "./IWETHV2.sol";

/// @notice Configuration-gated ETH/WETH -> ABCD sale adapter.
/// @dev Production execution remains impossible until every external address
///      and route is explicitly configured. Local mock configuration is only
///      test scaffolding and is labelled as such in the deployment manifest.
contract LiquidationSaleAdapterV2 is AccessControl, ReentrancyGuard, ILiquidationSaleAdapterV2 {
    using SafeERC20 for IERC20;

    bytes32 public constant CONFIG_ADMIN_ROLE = keccak256("CONFIG_ADMIN_ROLE");
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_SLIPPAGE_BPS = 100;

    address public liquidation;
    address public collateralVault;
    IERC20 public immutable abcd;
    address public weth;
    address public router;
    ILiquidationPriceValidatorV2 public validator;
    uint48 public maxDeadlineSeconds;

    address[] private route;
    mapping(uint256 => Recovery) private activeRecoveries;
    mapping(uint256 => Recovery) private lastRecoveries;
    mapping(uint256 => uint256) public pendingCollateral;

    event SaleConfigured(address indexed liquidation, address indexed vault, address indexed weth, address router, address validator, uint48 maxDeadlineSeconds, bytes32 routeHash);
    event CollateralReceived(uint256 indexed loanId, uint256 amount);
    event CollateralRecoveryFinalized(uint256 indexed loanId, uint256 collateralAmount, uint256 actualABCDReceived, address indexed router, bytes32 routeHash);

    constructor(address admin, address abcd_) {
        require(admin != address(0) && abcd_ != address(0), "invalid address");
        abcd = IERC20(abcd_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CONFIG_ADMIN_ROLE, admin);
    }

    function configured() public view returns (bool) {
        return liquidation != address(0)
            && collateralVault != address(0)
            && weth != address(0)
            && router != address(0)
            && address(validator) != address(0)
            && maxDeadlineSeconds != 0
            && route.length >= 2;
    }

    function configuredRoute() external view returns (address[] memory) { return route; }

    function configure(
        address liquidation_,
        address vault_,
        address weth_,
        address router_,
        address validator_,
        uint48 maxDeadlineSeconds_,
        address[] calldata route_
    ) external onlyRole(CONFIG_ADMIN_ROLE) {
        require(!configured(), "already configured");
        require(liquidation_ != address(0) && vault_ != address(0) && weth_ != address(0) && router_ != address(0) && validator_ != address(0) && maxDeadlineSeconds_ != 0, "invalid config");
        require(liquidation_.code.length != 0 && vault_.code.length != 0 && weth_.code.length != 0 && router_.code.length != 0 && validator_.code.length != 0, "config has no code");
        require(route_.length >= 2 && route_[0] == weth_ && route_[route_.length - 1] == address(abcd), "invalid route");
        require(IPancakeSwapRouterV2(router_).WETH() == weth_, "router/weth mismatch");

        liquidation = liquidation_;
        collateralVault = vault_;
        weth = weth_;
        router = router_;
        validator = ILiquidationPriceValidatorV2(validator_);
        maxDeadlineSeconds = maxDeadlineSeconds_;
        for (uint256 i; i < route_.length; ++i) {
            require(route_[i] != address(0), "route=0");
            route.push(route_[i]);
        }
        emit SaleConfigured(liquidation_, vault_, weth_, router_, validator_, maxDeadlineSeconds_, keccak256(abi.encode(route_)));
    }

    /// @notice Quote a normal margin-call partial liquidation. The validator
    /// derives exact required recovery; the adapter adds the fixed 1% route
    /// slippage guard and takes the stricter minimum output.
    function quote(uint256 loanId, uint256 debt, uint256 collateral, uint16 targetLtvBps)
        public
        view
        returns (SaleQuote memory quote_)
    {
        require(configured(), "sale configuration required");
        (quote_.collateralAmount, quote_.requiredRecovery, quote_.deadline) = validator.quoteSale(loanId, debt, collateral, targetLtvBps);
        uint256 routeQuote = _routeQuote(quote_.collateralAmount);
        uint256 routeMinOut = Math.mulDiv(routeQuote, BPS - MAX_SLIPPAGE_BPS, BPS);
        quote_.minOut = quote_.requiredRecovery > routeMinOut ? quote_.requiredRecovery : routeMinOut;
        require(quote_.collateralAmount != 0 && quote_.collateralAmount < collateral, "invalid partial sale amount");
        require(quote_.requiredRecovery != 0 && quote_.requiredRecovery < debt, "invalid partial recovery");
        require(quote_.minOut != 0 && routeQuote >= quote_.minOut, "route quote below recovery");
        require(quote_.deadline >= block.timestamp && quote_.deadline <= block.timestamp + maxDeadlineSeconds, "invalid deadline");
    }

    /// @notice Quote a due installment settlement. If oracle-priced remaining
    /// collateral cannot cover the entire due amount, the fixed-route minOut
    /// still protects the sale while the caller records the exact partial result.
    function quoteInstallment(uint256 loanId, uint256 due, uint256 collateral)
        public
        view
        returns (SaleQuote memory quote_)
    {
        require(configured(), "sale configuration required");
        (quote_.collateralAmount, quote_.requiredRecovery, quote_.deadline) = validator.quoteInstallmentSale(loanId, due, collateral);
        uint256 routeQuote = _routeQuote(quote_.collateralAmount);
        uint256 routeMinOut = Math.mulDiv(routeQuote, BPS - MAX_SLIPPAGE_BPS, BPS);
        quote_.minOut = quote_.requiredRecovery == due
            ? (due > routeMinOut ? due : routeMinOut)
            : routeMinOut;
        require(quote_.collateralAmount != 0 && quote_.collateralAmount <= collateral, "invalid installment sale amount");
        require(quote_.requiredRecovery != 0 && quote_.minOut != 0 && routeQuote >= quote_.minOut, "route quote below recovery");
        require(quote_.deadline >= block.timestamp && quote_.deadline <= block.timestamp + maxDeadlineSeconds, "invalid deadline");
    }

    function receiveCollateral(uint256 loanId) external payable {
        require(msg.sender == collateralVault && msg.value != 0 && pendingCollateral[loanId] == 0, "invalid collateral receipt");
        require(!activeRecoveries[loanId].finalized, "recovery pending");
        pendingCollateral[loanId] = msg.value;
        emit CollateralReceived(loanId, msg.value);
    }

    function executeSale(uint256 loanId, uint256 debt, uint256 collateral, uint16 targetLtvBps)
        external
        nonReentrant
        returns (uint256 actualReceived)
    {
        SaleQuote memory quote_ = quote(loanId, debt, collateral, targetLtvBps);
        return _execute(loanId, quote_);
    }

    function executeInstallmentSale(uint256 loanId, uint256 due, uint256 collateral)
        external
        nonReentrant
        returns (uint256 actualReceived)
    {
        SaleQuote memory quote_ = quoteInstallment(loanId, due, collateral);
        return _execute(loanId, quote_);
    }

    function _execute(uint256 loanId, SaleQuote memory quote_) private returns (uint256 actualReceived) {
        require(msg.sender == liquidation, "only liquidation");
        require(!activeRecoveries[loanId].finalized, "recovery finalized");
        require(pendingCollateral[loanId] == quote_.collateralAmount, "unexpected collateral");
        pendingCollateral[loanId] = 0;

        uint256 beforeBalance = abcd.balanceOf(address(this));
        IWETHV2(weth).deposit{value: quote_.collateralAmount}();
        IERC20(weth).forceApprove(router, quote_.collateralAmount);
        IPancakeSwapRouterV2(router).swapExactTokensForTokens(quote_.collateralAmount, quote_.minOut, route, address(this), quote_.deadline);
        actualReceived = abcd.balanceOf(address(this)) - beforeBalance;
        require(actualReceived != 0 && actualReceived >= quote_.minOut, "insufficient recovery");

        activeRecoveries[loanId] = Recovery(quote_.collateralAmount, actualReceived, true, false);
        abcd.safeTransfer(liquidation, actualReceived);
        emit CollateralRecoveryFinalized(loanId, quote_.collateralAmount, actualReceived, router, keccak256(abi.encode(route)));
    }

    /// @notice Consuming a recovery clears only the active operation. The last
    /// finalized result remains queryable for provenance while a later, valid
    /// due installment or a future margin-call operation can use the same loan.
    function consumeRecovery(uint256 loanId) external returns (Recovery memory result) {
        require(msg.sender == liquidation, "only liquidation");
        result = activeRecoveries[loanId];
        require(result.finalized && !result.consumed, "recovery unavailable");
        result.consumed = true;
        lastRecoveries[loanId] = result;
        delete activeRecoveries[loanId];
    }

    function recoveryOf(uint256 loanId) external view returns (Recovery memory) {
        Recovery memory active = activeRecoveries[loanId];
        return active.finalized ? active : lastRecoveries[loanId];
    }

    function _routeQuote(uint256 amountIn) private view returns (uint256 output) {
        uint256[] memory amounts = IPancakeSwapRouterV2(router).getAmountsOut(amountIn, route);
        require(amounts.length == route.length && amounts[0] == amountIn, "invalid route quote");
        output = amounts[amounts.length - 1];
        require(output != 0, "route quote required");
    }
}
