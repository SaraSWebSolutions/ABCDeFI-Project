// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../lending/v2/IPancakeSwapRouterV2.sol";

/// @dev Deterministic local-only router used to exercise adapter accounting.
/// It is not a price authority and cannot be used as production configuration.
contract MockPancakeSwapRouterV2 is IPancakeSwapRouterV2 {
    using SafeERC20 for IERC20;
    IERC20 public immutable inputToken;
    IERC20 public immutable outputToken;
    uint256 public rateNumerator;
    uint256 public rateDenominator;

    constructor(address input_, address output_, uint256 numerator_, uint256 denominator_) {
        require(input_ != address(0) && output_ != address(0) && numerator_ != 0 && denominator_ != 0, "invalid mock route");
        inputToken = IERC20(input_); outputToken = IERC20(output_); rateNumerator = numerator_; rateDenominator = denominator_;
    }

    function WETH() external view returns (address) { return address(inputToken); }

    function getAmountsOut(uint256 amountIn, address[] calldata path) external view returns (uint256[] memory amounts) {
        require(path.length == 2 && path[0] == address(inputToken) && path[1] == address(outputToken), "invalid mock route");
        amounts = new uint256[](2); amounts[0] = amountIn; amounts[1] = amountIn * rateNumerator / rateDenominator;
    }

    function setRate(uint256 numerator_, uint256 denominator_) external {
        require(numerator_ != 0 && denominator_ != 0, "invalid rate");
        rateNumerator = numerator_; rateDenominator = denominator_;
    }

    function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external returns (uint256[] memory amounts)
    {
        require(block.timestamp <= deadline && path.length == 2 && path[0] == address(inputToken) && path[1] == address(outputToken), "invalid mock swap");
        uint256 amountOut = amountIn * rateNumerator / rateDenominator;
        require(amountOut >= amountOutMin, "insufficient output");
        inputToken.safeTransferFrom(msg.sender, address(this), amountIn);
        outputToken.safeTransfer(to, amountOut);
        amounts = new uint256[](2); amounts[0] = amountIn; amounts[1] = amountOut;
    }
}
