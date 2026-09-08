// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Treasury is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    bytes32 public constant TREASURER_ROLE=keccak256("TREASURER_ROLE");
    bytes32 public constant WITHDRAWER_ROLE=keccak256("WITHDRAWER_ROLE");

    event ETHDeposited(address indexed from,uint256 amount);
    event ERC20Deposited(address indexed token,address indexed from,uint256 amount);
    event ETHWithdrawn(address indexed to,uint256 amount);
    event ERC20Withdrawn(address indexed token,address indexed to,uint256 amount);

    constructor(address admin){
        _grantRole(DEFAULT_ADMIN_ROLE,admin);
        _grantRole(TREASURER_ROLE,admin);
        _grantRole(WITHDRAWER_ROLE,admin);
    }

    receive() external payable { emit ETHDeposited(msg.sender,msg.value); }

    function depositERC20(address token,uint256 amount) external whenNotPaused nonReentrant {
        require(amount>0,"Invalid amount");
        IERC20(token).safeTransferFrom(msg.sender,address(this),amount);
        emit ERC20Deposited(token,msg.sender,amount);
    }

    function withdrawETH(address payable to,uint256 amount) external onlyRole(WITHDRAWER_ROLE) whenNotPaused nonReentrant {
        require(address(this).balance>=amount,"Insufficient");
        (bool ok,)=to.call{value:amount}("");
        require(ok,"Failed");
        emit ETHWithdrawn(to,amount);
    }

    function withdrawERC20(address token,address to,uint256 amount) external onlyRole(WITHDRAWER_ROLE) whenNotPaused nonReentrant {
        IERC20(token).safeTransfer(to,amount);
        emit ERC20Withdrawn(token,to,amount);
    }

    function pause() external onlyRole(TREASURER_ROLE){_pause();}
    function unpause() external onlyRole(TREASURER_ROLE){_unpause();}
    function grantTreasurer(address a) external onlyRole(DEFAULT_ADMIN_ROLE){grantRole(TREASURER_ROLE,a);}
    function grantWithdrawer(address a) external onlyRole(DEFAULT_ADMIN_ROLE){grantRole(WITHDRAWER_ROLE,a);}
    function ethBalance() external view returns(uint256){return address(this).balance;}
    function tokenBalance(address token) external view returns(uint256){return IERC20(token).balanceOf(address(this));}
}
