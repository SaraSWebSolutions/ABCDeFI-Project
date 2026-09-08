// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IABCD is IERC20 {
    // token contract should already have minted ICO allocation to this contract
}

contract ICOManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IABCD public immutable token;

    struct Stage {
        string name;
        uint256 pricePerPaymentToken; // tokens per 1 unit of payment token (18-decimals scale)
        uint256 tokensAvailable;
        uint256 start;
        uint256 end;
        uint256 bonusPercent; // additional percent (e.g., 10 => +10%)
        bool active;
    }

    Stage[] public stages;

    // track tokens sold per stage
    mapping(uint256 => uint256) public tokensSold;

    // purchases
    event Purchased(address indexed buyer, uint256 stageId, address paymentToken, uint256 paymentAmount, uint256 tokensReceived, address indexed referrer);

    constructor(address tokenAddr) Ownable(msg.sender) {
        require(tokenAddr != address(0), "zero token");
        token = IABCD(tokenAddr);
    }

    function addStage(
        string memory name,
        uint256 pricePerPaymentToken,
        uint256 tokensAvailable,
        uint256 start,
        uint256 end,
        uint256 bonusPercent
    ) external onlyOwner {
        require(start < end, "invalid dates");
        stages.push(Stage(name, pricePerPaymentToken, tokensAvailable, start, end, bonusPercent, true));
    }

    function updateStage(uint256 id, Stage calldata s) external onlyOwner {
        require(id < stages.length, "invalid id");
        stages[id] = s;
    }

    // paymentToken == address(0) means native ETH
    function buy(uint256 stageId, address paymentToken, uint256 paymentAmount, address referrer) external payable nonReentrant {
        require(stageId < stages.length, "invalid stage");
        Stage storage s = stages[stageId];
        require(s.active, "stage not active");
        require(block.timestamp >= s.start && block.timestamp <= s.end, "stage closed");

        // pull payment
        if (paymentToken == address(0)) {
            require(msg.value == paymentAmount, "incorrect msg.value");
        } else {
            require(msg.value == 0, "send no ETH");
            IERC20(paymentToken).safeTransferFrom(msg.sender, address(this), paymentAmount);
        }

        // calculate tokens: tokens = paymentAmount * pricePerPaymentToken / 1e18
        uint256 tokens = (paymentAmount * s.pricePerPaymentToken) / 1e18;
        require(tokens > 0, "zero tokens");
        require(tokensSold[stageId] + tokens <= s.tokensAvailable, "not enough tokens in stage");

        // apply bonus
        uint256 bonus = (tokens * s.bonusPercent) / 100;
        uint256 total = tokens + bonus;

        tokensSold[stageId] += total;

        // transfer tokens from this contract (ICO allocation should be held here)
        require(token.balanceOf(address(this)) >= total, "insufficient ICO tokens in contract");
        token.transfer(msg.sender, total);

        emit Purchased(msg.sender, stageId, paymentToken, paymentAmount, total, referrer);
    }

    // Owner can withdraw collected payments
    function withdraw(address tokenAddr, address to, uint256 amount) external onlyOwner {
        if (tokenAddr == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(tokenAddr).safeTransfer(to, amount);
        }
    }

    // view helpers
    function stageCount() external view returns (uint256) { return stages.length; }
}
